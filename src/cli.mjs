#!/usr/bin/env node
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { DEFAULT_CONFIG, loadConfig } from './config.mjs';
import { parseTransactionHex } from './bitcoin/transaction.mjs';
import { PublicJobStore } from './coordinator/job-store.mjs';
import { AnnouncementRegistry } from './discovery/registry.mjs';
import { startGossipLoop } from './discovery/gossip.mjs';
import { evaluateRescueCandidate } from './economics/scheduler.mjs';
import { createApiServer, listenApi } from './http/server.mjs';
import { objectDigest } from './lib/crypto.mjs';
import { mineAnnouncement } from './protocol/announcement.mjs';
import { generateSigningKeys, loadPrivateKey, loadPublicKey } from './security/keys.mjs';
import { generateMasterKey, readMasterKey, SealedStore } from './security/sealed-store.mjs';

const REPOSITORY_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function argumentValue(name, fallback) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : fallback;
}

function configPath() {
  return path.resolve(argumentValue('--config', 'config.local.json'));
}

async function writeExclusive(filePath, contents, mode = 0o600) {
  await fs.mkdir(path.dirname(filePath), { recursive: true, mode: 0o700 });
  await fs.writeFile(filePath, contents, { encoding: 'utf8', mode, flag: 'wx' });
  try { await fs.chmod(filePath, mode); } catch { /* Best effort on Windows. */ }
}

async function exists(filePath) {
  try { await fs.access(filePath); return true; } catch { return false; }
}

async function initialize() {
  const targetConfig = configPath();
  if (!(await exists(targetConfig))) {
    await writeExclusive(targetConfig, `${JSON.stringify(DEFAULT_CONFIG, null, 2)}\n`);
  }
  const config = await loadConfig(targetConfig);
  await fs.mkdir(config.security.runtimeDirectory, { recursive: true, mode: 0o700 });
  if (!(await exists(config.security.masterKeyFile))) await generateMasterKey(config.security.masterKeyFile);
  const privateExists = await exists(config.security.signingPrivateKeyFile);
  const publicExists = await exists(config.security.signingPublicKeyFile);
  if (privateExists !== publicExists) throw new Error('Signing key pair is incomplete; refusing to replace either half');
  if (!privateExists) await generateSigningKeys(config.security.signingPrivateKeyFile, config.security.signingPublicKeyFile);
  if (!(await exists(config.security.apiTokenFile))) {
    await writeExclusive(config.security.apiTokenFile, `${crypto.randomBytes(32).toString('base64url')}\n`);
  }
  console.log(JSON.stringify({
    initialized: true,
    network: config.network,
    mainnetLocked: true,
    runtimeDirectory: config.security.runtimeDirectory,
    secretsCreated: true,
  }, null, 2));
}

async function doctor() {
  const config = await loadConfig(configPath());
  const checks = [];
  for (const [name, file] of [
    ['master-key', config.security.masterKeyFile],
    ['signing-private-key', config.security.signingPrivateKeyFile],
    ['signing-public-key', config.security.signingPublicKeyFile],
    ['api-token', config.security.apiTokenFile],
  ]) checks.push({ name, ok: await exists(file), detail: await exists(file) ? 'present' : 'missing' });
  checks.push({ name: 'api-loopback', ok: ['127.0.0.1', '::1', 'localhost'].includes(config.api.host), detail: config.api.host });
  checks.push({ name: 'raw-http-disabled', ok: config.security.allowRawTransactionHttp === false, detail: 'hard invariant' });
  checks.push({ name: 'mainnet-broadcaster', ok: config.network !== 'mainnet', detail: 'not implemented' });
  const ok = checks.every((check) => check.ok);
  console.log(JSON.stringify({ ok, network: config.network, checks }, null, 2));
  if (!ok) process.exitCode = 1;
}

async function readStdin(maximumBytes = 4_000_000) {
  if (process.stdin.isTTY) throw new Error('Sensitive input must be piped over standard input');
  const chunks = [];
  let length = 0;
  for await (const chunk of process.stdin) {
    length += chunk.length;
    if (length > maximumBytes) throw new Error('Sensitive input is too large');
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString('utf8').trim();
}

async function sealLocal() {
  const id = argumentValue('--id');
  if (!id) throw new Error('seal requires --id');
  const config = await loadConfig(configPath());
  const rawHex = await readStdin();
  if (!/^[0-9a-f]+$/i.test(rawHex) || rawHex.length % 2 !== 0 || rawHex.length < 20) {
    throw new Error('Standard input must be an even-length hexadecimal transaction');
  }
  const analysis = parseTransactionHex(rawHex);
  const key = await readMasterKey(config.security.masterKeyFile);
  const store = new SealedStore(path.join(config.security.runtimeDirectory, 'sealed'), key);
  const result = await store.put(id, Buffer.from(rawHex, 'hex'), {
    kind: 'bitcoin-transaction',
    network: config.network,
    byteLength: analysis.size,
    transactionDigest: objectDigest({ txid: analysis.txid }),
    vsize: analysis.vsize,
  });
  console.log(JSON.stringify(result, null, 2));
}

async function simulate() {
  const result = evaluateRescueCandidate({
    rescueVsize: Number(argumentValue('--vsize', 12318)),
    rescueFeeSats: Number(argumentValue('--fee', 12318)),
    freeSpaceVbytes: Number(argumentValue('--free-space', 12318)),
    marginalRateMilliSatsPerVbyte: Math.round(Number(argumentValue('--marginal-rate', 1)) * 1000),
    auxiliaryRevenueSats: Number(argumentValue('--auxiliary', 0)),
    infrastructureSavingsSats: Number(argumentValue('--savings', 0)),
    minimumNetGainSats: Number(argumentValue('--minimum-gain', 0)),
  });
  console.log(JSON.stringify(result, null, 2));
}

async function createAnnouncement() {
  const config = await loadConfig(configPath());
  if (!config.discovery.enabled) throw new Error('Discovery is disabled in configuration');
  const privateKey = await loadPrivateKey(config.security.signingPrivateKeyFile);
  const publicKey = await loadPublicKey(config.security.signingPublicKeyFile);
  const record = mineAnnouncement({
    privateKey,
    publicKey,
    endpoint: config.discovery.endpoint,
    capabilities: ['sealed-jobs', 'proof-of-help', 'marginal-scheduler'],
    policyDigest: objectDigest({ economics: config.economics, network: config.network }),
    ttlSeconds: config.discovery.maximumTtlSeconds,
    powBits: config.discovery.minimumPowBits,
    allowLocal: config.network === 'regtest',
  });
  const output = path.join(config.security.runtimeDirectory, 'public-announcement.json');
  await fs.writeFile(output, `${JSON.stringify(record, null, 2)}\n`, { encoding: 'utf8', mode: 0o600 });
  console.log(JSON.stringify({ created: true, output, nodeId: record.nodeId, expiresAt: record.expiresAt }, null, 2));
}

async function serve() {
  const config = await loadConfig(configPath());
  const apiToken = (await fs.readFile(config.security.apiTokenFile, 'utf8')).trim();
  const registry = new AnnouncementRegistry({
    minimumPowBits: config.discovery.minimumPowBits,
    maximumTtlSeconds: config.discovery.maximumTtlSeconds,
    allowLocal: config.network === 'regtest',
  });
  const jobs = new PublicJobStore();
  const server = createApiServer({ config, registry, jobs, apiToken });
  let stopGossip = () => {};
  if (config.discovery.enabled && config.discovery.automaticAnnounce) {
    const privateKey = await loadPrivateKey(config.security.signingPrivateKeyFile);
    const publicKey = await loadPublicKey(config.security.signingPublicKeyFile);
    stopGossip = startGossipLoop({
      registry,
      seeds: config.discovery.seeds,
      intervalMs: Math.max(30_000, Math.floor(config.discovery.maximumTtlSeconds * 500)),
      createAnnouncement: async () => mineAnnouncement({
        privateKey,
        publicKey,
        endpoint: config.discovery.endpoint,
        capabilities: ['sealed-jobs', 'proof-of-help', 'marginal-scheduler'],
        policyDigest: objectDigest({ economics: config.economics, network: config.network }),
        ttlSeconds: config.discovery.maximumTtlSeconds,
        powBits: config.discovery.minimumPowBits,
        allowLocal: config.network === 'regtest',
      }),
      onResult: (result) => console.log(result.ok ? `Discovery refresh: ${result.peers.length} seed(s)` : 'Discovery refresh failed safely'),
    });
  }
  const address = await listenApi(server, config);
  console.log(`RescueMesh local dashboard: http://${config.api.host}:${address.port}`);
  console.log(`Network: ${config.network}; mainnet broadcaster: unavailable; raw HTTP: disabled`);
  const close = () => { stopGossip(); server.close(() => process.exit(0)); };
  process.once('SIGINT', close);
  process.once('SIGTERM', close);
}

function help() {
  console.log('RescueMesh 0.1.0\n\nCommands:\n  init\n  doctor\n  serve\n  simulate\n  seal --id <safe-id>    (reads sensitive hex from stdin)\n  announcement           (creates a signed record; never broadcasts it)\n\nOptions:\n  --config <path>\n');
}

async function main() {
  const command = process.argv[2] || 'help';
  if (command === 'init') return initialize();
  if (command === 'doctor') return doctor();
  if (command === 'serve') return serve();
  if (command === 'simulate') return simulate();
  if (command === 'seal') return sealLocal();
  if (command === 'announcement') return createAnnouncement();
  if (command === 'help' || command === '--help' || command === '-h') return help();
  throw new Error(`Unknown command: ${command}`);
}

main().catch((error) => {
  console.error(`RescueMesh refused the operation: ${error.message}`);
  process.exitCode = 1;
});
