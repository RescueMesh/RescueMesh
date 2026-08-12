import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { SealedStore, sealBytes, unsealBytes } from '../src/security/sealed-store.mjs';

test('AES-GCM sealed envelope round-trips with authenticated metadata', () => {
  const key = crypto.randomBytes(32);
  const aad = { id: 'synthetic', network: 'regtest' };
  const envelope = sealBytes(Buffer.from('private synthetic bytes'), key, aad);
  assert.equal(unsealBytes(envelope, key, aad).toString(), 'private synthetic bytes');
  assert.throws(() => unsealBytes(envelope, key, { ...aad, network: 'mainnet' }), /metadata mismatch/);
});

test('ciphertext tampering is detected', () => {
  const key = crypto.randomBytes(32);
  const envelope = sealBytes(Buffer.from('secret'), key, {});
  const bytes = Buffer.from(envelope.ciphertext, 'base64');
  bytes[0] ^= 1;
  envelope.ciphertext = bytes.toString('base64');
  assert.throws(() => unsealBytes(envelope, key, {}));
});

test('sealed store never writes plaintext', async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'rescuemesh-sealed-'));
  const store = new SealedStore(directory, crypto.randomBytes(32));
  await store.put('regtest-item', Buffer.from('DO-NOT-LEAK'), { network: 'regtest', identifyingNote: 'PRIVATE-METADATA' });
  const disk = await fs.readFile(path.join(directory, 'regtest-item.sealed.json'), 'utf8');
  assert.equal(disk.includes('DO-NOT-LEAK'), false);
  assert.equal(disk.includes('PRIVATE-METADATA'), false);
  assert.equal((await store.get('regtest-item')).toString(), 'DO-NOT-LEAK');
});
