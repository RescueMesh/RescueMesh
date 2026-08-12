import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';

async function exclusiveWrite(filePath, data) {
  await fs.mkdir(path.dirname(filePath), { recursive: true, mode: 0o700 });
  await fs.writeFile(filePath, data, { encoding: 'utf8', flag: 'wx', mode: 0o600 });
  try { await fs.chmod(filePath, 0o600); } catch { /* Best effort on Windows. */ }
}

export async function generateSigningKeys(privatePath, publicPath) {
  const { privateKey, publicKey } = crypto.generateKeyPairSync('ed25519');
  const privatePem = privateKey.export({ format: 'pem', type: 'pkcs8' });
  const publicPem = publicKey.export({ format: 'pem', type: 'spki' });
  try {
    await exclusiveWrite(privatePath, privatePem);
    await exclusiveWrite(publicPath, publicPem);
  } catch (error) {
    if (error.code !== 'EEXIST') throw error;
    throw new Error('Refusing to replace existing signing keys');
  }
}

export async function loadPrivateKey(filePath) {
  return crypto.createPrivateKey(await fs.readFile(filePath, 'utf8'));
}

export async function loadPublicKey(filePath) {
  return crypto.createPublicKey(await fs.readFile(filePath, 'utf8'));
}

export function publicKeyPem(key) {
  return key.export({ format: 'pem', type: 'spki' }).toString();
}

export function nodeIdFromPublicKey(key) {
  const der = key.export({ format: 'der', type: 'spki' });
  return crypto.createHash('sha256').update(der).digest('hex');
}
