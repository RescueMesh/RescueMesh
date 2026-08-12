import crypto from 'node:crypto';
import { canonicalBytes } from '../lib/canonical-json.mjs';
import { countLeadingZeroBits, objectDigest, sha256 } from '../lib/crypto.mjs';
import { assertHex, assertInteger } from '../lib/validation.mjs';
import { nodeIdFromPublicKey, publicKeyPem } from '../security/keys.mjs';

const CAPABILITIES = new Set(['sealed-jobs', 'proof-of-help', 'marginal-scheduler', 'stratum-v1', 'stratum-v2-jd', 'datum']);

function validateEndpoint(value, allowLocal = false) {
  const parsed = new URL(value);
  const onion = parsed.hostname.endsWith('.onion') && ['http:', 'https:'].includes(parsed.protocol);
  const secure = parsed.protocol === 'https:';
  const local = allowLocal && ['127.0.0.1', 'localhost', '::1', '[::1]'].includes(parsed.hostname);
  if (!onion && !secure && !local) throw new Error('Discovery endpoint must be HTTPS, onion, or an allowed loopback URL');
  if (parsed.username || parsed.password || parsed.search || parsed.hash) throw new Error('Discovery endpoint cannot contain credentials, query or fragment');
  return parsed.toString().replace(/\/$/, '');
}

function unsignedRecord(record) {
  const { signature, ...unsigned } = record;
  return unsigned;
}

export function mineAnnouncement({ privateKey, publicKey, endpoint, capabilities, policyDigest, ttlSeconds = 900, powBits = 16, now = Date.now(), allowLocal = false }) {
  assertInteger(ttlSeconds, { label: 'ttlSeconds', minimum: 60, maximum: 3600 });
  assertInteger(powBits, { label: 'powBits', minimum: 4, maximum: 28 });
  const uniqueCapabilities = [...new Set(capabilities)].sort();
  if (uniqueCapabilities.length === 0 || uniqueCapabilities.some((item) => !CAPABILITIES.has(item))) {
    throw new Error('Announcement contains unsupported capabilities');
  }
  const base = {
    schema: 'rescuemesh/announcement/v1',
    nodeId: nodeIdFromPublicKey(publicKey),
    publicKey: publicKeyPem(publicKey),
    endpoint: validateEndpoint(endpoint, allowLocal),
    capabilities: uniqueCapabilities,
    policyDigest: assertHex(policyDigest, 32, 'policyDigest'),
    issuedAt: new Date(now).toISOString(),
    expiresAt: new Date(now + ttlSeconds * 1000).toISOString(),
    powBits,
    nonce: 0,
  };
  let digest;
  do {
    digest = sha256(canonicalBytes(base));
    if (countLeadingZeroBits(digest) >= powBits) break;
    base.nonce += 1;
    if (base.nonce > 25_000_000) throw new Error('Announcement proof-of-work budget exhausted');
  } while (true);
  const signature = crypto.sign(null, digest, privateKey).toString('base64');
  return { ...base, signature };
}

export function verifyAnnouncement(record, options = {}) {
  const now = options.now ?? Date.now();
  const minimumPowBits = options.minimumPowBits ?? 16;
  const maximumTtlSeconds = options.maximumTtlSeconds ?? 1800;
  if (!record || record.schema !== 'rescuemesh/announcement/v1') throw new Error('Unsupported announcement schema');
  const expectedKeys = new Set(['schema', 'nodeId', 'publicKey', 'endpoint', 'capabilities', 'policyDigest', 'issuedAt', 'expiresAt', 'powBits', 'nonce', 'signature']);
  if (Object.keys(record).some((key) => !expectedKeys.has(key))) throw new Error('Announcement contains an unknown field');
  assertHex(record.policyDigest, 32, 'policyDigest');
  assertInteger(record.nonce, { label: 'announcement.nonce', minimum: 0, maximum: 25_000_000 });
  validateEndpoint(record.endpoint, options.allowLocal === true);
  if (!Array.isArray(record.capabilities) || record.capabilities.some((item) => !CAPABILITIES.has(item))) {
    throw new Error('Invalid announcement capabilities');
  }
  const issued = Date.parse(record.issuedAt);
  const expires = Date.parse(record.expiresAt);
  if (!Number.isFinite(issued) || !Number.isFinite(expires)) throw new Error('Invalid announcement timestamps');
  if (issued > now + 300_000) throw new Error('Announcement is too far in the future');
  if (expires <= now) throw new Error('Announcement has expired');
  if (expires - issued > maximumTtlSeconds * 1000) throw new Error('Announcement TTL is too long');
  if (!Number.isInteger(record.powBits) || record.powBits < minimumPowBits || record.powBits > 28) throw new Error('Announcement proof of work is insufficient');
  if (typeof record.publicKey !== 'string' || record.publicKey.length > 256) throw new Error('Announcement public key is malformed');
  if (typeof record.signature !== 'string' || record.signature.length > 128) throw new Error('Announcement signature is malformed');
  const publicKey = crypto.createPublicKey(record.publicKey);
  if (nodeIdFromPublicKey(publicKey) !== record.nodeId) throw new Error('Announcement node id does not match its key');
  const digest = sha256(canonicalBytes(unsignedRecord(record)));
  if (countLeadingZeroBits(digest) < record.powBits) throw new Error('Announcement proof of work is invalid');
  if (!crypto.verify(null, digest, publicKey, Buffer.from(record.signature, 'base64'))) {
    throw new Error('Announcement signature is invalid');
  }
  return { valid: true, nodeId: record.nodeId, digest: objectDigest(unsignedRecord(record)), expiresAt: record.expiresAt };
}

export { CAPABILITIES };
