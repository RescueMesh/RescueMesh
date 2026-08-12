import fs from 'node:fs/promises';
import path from 'node:path';
import { assertInteger, assertPlainObject } from './lib/validation.mjs';

const DEFAULT_CONFIG = Object.freeze({
  network: 'regtest',
  api: { host: '127.0.0.1', port: 39393, maxBodyBytes: 32768, requestsPerMinute: 120 },
  mainnet: { enabled: false, submissionEnabled: false },
  discovery: {
    enabled: false,
    automaticAnnounce: false,
    minimumPowBits: 16,
    maximumTtlSeconds: 1800,
    endpoint: 'http://127.0.0.1:39393',
    seeds: [],
  },
  economics: { minimumNetGainSats: 0, maximumRescueVsize: 100000, maximumFreeJobsPerTemplate: 1 },
  security: {
    runtimeDirectory: 'runtime',
    masterKeyFile: 'runtime/secrets/master.key',
    signingPrivateKeyFile: 'runtime/secrets/signing-private.pem',
    signingPublicKeyFile: 'runtime/secrets/signing-public.pem',
    apiTokenFile: 'runtime/secrets/api.token',
    allowRemoteApi: false,
    allowRawTransactionHttp: false,
  },
});

const TOP_LEVEL_KEYS = new Set(Object.keys(DEFAULT_CONFIG));

function mergeKnown(defaults, provided, pathLabel) {
  assertPlainObject(provided, pathLabel);
  const result = { ...defaults };
  for (const [key, value] of Object.entries(provided)) {
    if (!(key in defaults)) throw new Error(`Unknown configuration key: ${pathLabel}.${key}`);
    if (defaults[key] && typeof defaults[key] === 'object' && !Array.isArray(defaults[key])) {
      result[key] = mergeKnown(defaults[key], value, `${pathLabel}.${key}`);
    } else {
      result[key] = value;
    }
  }
  return result;
}

function isLoopback(host) {
  return new Set(['127.0.0.1', '::1', 'localhost']).has(host);
}

export function validateConfig(value) {
  assertPlainObject(value, 'config');
  for (const key of Object.keys(value)) {
    if (!TOP_LEVEL_KEYS.has(key)) throw new Error(`Unknown configuration key: config.${key}`);
  }
  const config = mergeKnown(DEFAULT_CONFIG, value, 'config');
  if (!['regtest', 'testnet4', 'signet', 'mainnet'].includes(config.network)) {
    throw new Error('network must be regtest, testnet4, signet or mainnet');
  }
  assertInteger(config.api.port, { label: 'api.port', minimum: 1, maximum: 65535 });
  assertInteger(config.api.maxBodyBytes, { label: 'api.maxBodyBytes', minimum: 1024, maximum: 1048576 });
  assertInteger(config.api.requestsPerMinute, { label: 'api.requestsPerMinute', minimum: 1, maximum: 10000 });
  assertInteger(config.discovery.minimumPowBits, { label: 'discovery.minimumPowBits', minimum: 4, maximum: 28 });
  assertInteger(config.discovery.maximumTtlSeconds, { label: 'discovery.maximumTtlSeconds', minimum: 60, maximum: 3600 });
  assertInteger(config.economics.minimumNetGainSats, { label: 'economics.minimumNetGainSats', minimum: 0 });
  assertInteger(config.economics.maximumRescueVsize, { label: 'economics.maximumRescueVsize', minimum: 1, maximum: 1000000 });

  if (!isLoopback(config.api.host) && config.security.allowRemoteApi !== true) {
    throw new Error('Remote API binding is blocked; keep api.host on loopback');
  }
  if (config.security.allowRawTransactionHttp !== false) {
    throw new Error('Raw transaction HTTP transport is a non-negotiable security invariant');
  }
  if (config.discovery.automaticAnnounce === true && config.discovery.enabled !== true) {
    throw new Error('Automatic announcement requires discovery.enabled');
  }
  if (!Array.isArray(config.discovery.seeds) || config.discovery.seeds.length > 32 || config.discovery.seeds.some((seed) => typeof seed !== 'string' || seed.length > 512)) {
    throw new Error('discovery.seeds must be a bounded array of URLs');
  }
  if (config.network === 'mainnet') {
    if (config.mainnet.enabled !== true || config.mainnet.submissionEnabled !== true) {
      throw new Error('Mainnet requires both explicit mainnet interlocks');
    }
    if (process.env.RESCUEMESH_MAINNET_ACK !== 'I_UNDERSTAND_RESCUEMESH_MAINNET_RISK') {
      throw new Error('Mainnet acknowledgement is absent');
    }
    throw new Error('Mainnet broadcaster is intentionally not implemented in this prototype');
  }
  return config;
}

export async function loadConfig(filePath = 'config.local.json') {
  let provided = {};
  try {
    provided = JSON.parse(await fs.readFile(filePath, 'utf8'));
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
  const config = validateConfig(provided);
  const base = path.dirname(path.resolve(filePath));
  for (const key of ['runtimeDirectory', 'masterKeyFile', 'signingPrivateKeyFile', 'signingPublicKeyFile', 'apiTokenFile']) {
    config.security[key] = path.resolve(base, config.security[key]);
  }
  return config;
}

export { DEFAULT_CONFIG, isLoopback };
