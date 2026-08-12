import crypto from 'node:crypto';
import { canonicalBytes } from '../lib/canonical-json.mjs';
import { objectDigest, randomId, sha256 } from '../lib/crypto.mjs';
import { assertInteger, assertSafeId, assertTxid } from '../lib/validation.mjs';

const ROLES = new Set(['rescue', 'sponsor', 'standard']);

function normalizeTransaction(entry, index) {
  if (!entry || typeof entry !== 'object') throw new TypeError(`transactions[${index}] must be an object`);
  if (!ROLES.has(entry.role)) throw new TypeError(`transactions[${index}].role is invalid`);
  return {
    role: entry.role,
    txid: assertTxid(entry.txid, `transactions[${index}].txid`),
    feeSats: assertInteger(entry.feeSats, { label: `transactions[${index}].feeSats`, minimum: 0 }),
    vsize: assertInteger(entry.vsize, { label: `transactions[${index}].vsize`, minimum: 1, maximum: 1000000 }),
  };
}

export function buildSealedBundle({ id = `bundle-${randomId(8)}`, transactions, expiresAt, salt = crypto.randomBytes(32) }) {
  assertSafeId(id);
  if (!Array.isArray(transactions) || transactions.length === 0) throw new Error('Bundle requires transactions');
  const normalized = transactions.map(normalizeTransaction);
  if (!normalized.some((entry) => entry.role === 'rescue')) throw new Error('Bundle requires at least one rescue transaction');
  const txids = normalized.map((entry) => entry.txid);
  if (new Set(txids).size !== txids.length) throw new Error('Bundle contains duplicate txids');
  const expiryMs = Date.parse(expiresAt);
  if (!Number.isFinite(expiryMs) || expiryMs <= Date.now()) throw new Error('Bundle expiry must be in the future');
  const saltBuffer = Buffer.from(salt);
  if (saltBuffer.length < 16) throw new Error('Bundle commitment salt must be at least 16 bytes');

  const privateManifest = {
    schema: 'rescuemesh/private-bundle/v1',
    id,
    transactions: normalized,
    expiresAt: new Date(expiryMs).toISOString(),
    salt: saltBuffer.toString('base64'),
  };
  // A normal one-leaf Bitcoin Merkle tree equals the txid and would reveal it.
  // These leaves are salted commitments, not Bitcoin transaction hashes.
  let commitmentLevel = normalized.map((entry, index) => sha256(Buffer.concat([
    saltBuffer,
    Buffer.from(index.toString(10), 'ascii'),
    Buffer.from(entry.role, 'utf8'),
    Buffer.from(entry.txid, 'hex'),
  ])));
  while (commitmentLevel.length > 1) {
    if (commitmentLevel.length % 2 === 1) commitmentLevel.push(Buffer.from(commitmentLevel.at(-1)));
    const next = [];
    for (let index = 0; index < commitmentLevel.length; index += 2) {
      next.push(sha256(Buffer.concat([commitmentLevel[index], commitmentLevel[index + 1]])));
    }
    commitmentLevel = next;
  }
  const roleCounts = Object.fromEntries([...ROLES].map((role) => [role, normalized.filter((entry) => entry.role === role).length]));
  const publicEnvelope = {
    schema: 'rescuemesh/public-bundle/v1',
    id,
    transactionCount: normalized.length,
    roleCounts,
    totalFeesSats: normalized.reduce((sum, entry) => sum + entry.feeSats, 0),
    totalVsize: normalized.reduce((sum, entry) => sum + entry.vsize, 0),
    sealedSetRoot: commitmentLevel[0].toString('hex'),
    sealedManifestCommitment: sha256(canonicalBytes(privateManifest)).toString('hex'),
    expiresAt: privateManifest.expiresAt,
  };
  return { publicEnvelope, privateManifest };
}

export function verifyBundleOpening(publicEnvelope, privateManifest) {
  if (publicEnvelope.id !== privateManifest.id) return false;
  if (publicEnvelope.sealedManifestCommitment !== objectDigest(privateManifest)) return false;
  const rebuilt = buildSealedBundle({
    id: privateManifest.id,
    transactions: privateManifest.transactions,
    expiresAt: privateManifest.expiresAt,
    salt: Buffer.from(privateManifest.salt, 'base64'),
  });
  return publicEnvelope.sealedSetRoot === rebuilt.publicEnvelope.sealedSetRoot;
}
