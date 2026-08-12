import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { canonicalBytes } from '../lib/canonical-json.mjs';
import { objectDigest, randomId } from '../lib/crypto.mjs';
import { assertSafeId } from '../lib/validation.mjs';

const FORMAT_VERSION = 1;
const ALGORITHM = 'aes-256-gcm';

export function decodeMasterKey(value) {
  const text = String(value).trim();
  let key;
  if (/^[0-9a-f]{64}$/i.test(text)) key = Buffer.from(text, 'hex');
  else key = Buffer.from(text, 'base64');
  if (key.length !== 32) throw new Error('Master key must decode to exactly 32 bytes');
  return key;
}

export function sealBytes(plaintext, key, aad = {}) {
  if (!Buffer.isBuffer(plaintext)) plaintext = Buffer.from(plaintext);
  if (!Buffer.isBuffer(key) || key.length !== 32) throw new Error('AES-256-GCM requires a 32-byte key');
  const nonce = crypto.randomBytes(12);
  const aadBytes = canonicalBytes(aad);
  const cipher = crypto.createCipheriv(ALGORITHM, key, nonce, { authTagLength: 16 });
  cipher.setAAD(aadBytes);
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  return {
    version: FORMAT_VERSION,
    algorithm: ALGORITHM,
    nonce: nonce.toString('base64'),
    ciphertext: ciphertext.toString('base64'),
    authTag: cipher.getAuthTag().toString('base64'),
    aadDigest: objectDigest(aad),
  };
}

export function unsealBytes(envelope, key, aad = {}) {
  if (envelope?.version !== FORMAT_VERSION || envelope?.algorithm !== ALGORITHM) {
    throw new Error('Unsupported sealed envelope');
  }
  if (envelope.aadDigest !== objectDigest(aad)) throw new Error('Sealed envelope metadata mismatch');
  const decipher = crypto.createDecipheriv(ALGORITHM, key, Buffer.from(envelope.nonce, 'base64'), { authTagLength: 16 });
  decipher.setAAD(canonicalBytes(aad));
  decipher.setAuthTag(Buffer.from(envelope.authTag, 'base64'));
  return Buffer.concat([decipher.update(Buffer.from(envelope.ciphertext, 'base64')), decipher.final()]);
}

async function atomicPrivateWrite(filePath, contents) {
  await fs.mkdir(path.dirname(filePath), { recursive: true, mode: 0o700 });
  const temporary = `${filePath}.${process.pid}.${randomId(6)}.tmp`;
  await fs.writeFile(temporary, contents, { encoding: 'utf8', mode: 0o600, flag: 'wx' });
  await fs.rename(temporary, filePath);
  try { await fs.chmod(filePath, 0o600); } catch { /* Windows ACLs need separate hardening. */ }
}

export async function generateMasterKey(filePath) {
  const key = crypto.randomBytes(32).toString('base64');
  await fs.mkdir(path.dirname(filePath), { recursive: true, mode: 0o700 });
  try {
    await fs.writeFile(filePath, `${key}\n`, { encoding: 'utf8', mode: 0o600, flag: 'wx' });
  } catch (error) {
    if (error.code !== 'EEXIST') throw error;
    throw new Error(`Refusing to replace existing master key: ${filePath}`);
  }
  return filePath;
}

export async function readMasterKey(filePath) {
  return decodeMasterKey(await fs.readFile(filePath, 'utf8'));
}

export class SealedStore {
  constructor(directory, key) {
    this.directory = path.resolve(directory);
    this.key = key;
  }

  fileFor(id) {
    return path.join(this.directory, `${assertSafeId(id)}.sealed.json`);
  }

  async put(id, plaintext, metadata = {}) {
    assertSafeId(id);
    // Metadata can itself be identifying. Authenticate only its digest so the
    // envelope never writes caller-provided metadata in clear text.
    const aad = { id, metadataDigest: objectDigest(metadata), schema: 'rescuemesh/sealed-item/v1' };
    const envelope = sealBytes(plaintext, this.key, aad);
    await atomicPrivateWrite(this.fileFor(id), `${JSON.stringify({ aad, envelope }, null, 2)}\n`);
    return { id, sealed: true, metadataDigest: objectDigest(metadata) };
  }

  async get(id) {
    const parsed = JSON.parse(await fs.readFile(this.fileFor(id), 'utf8'));
    return unsealBytes(parsed.envelope, this.key, parsed.aad);
  }

  async remove(id) {
    await fs.unlink(this.fileFor(id));
  }
}
