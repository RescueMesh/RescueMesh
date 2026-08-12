import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { HelpLedger, verifyHelpReceipt, verifyWorkShare } from '../src/protocol/proof-of-help.mjs';

function workFixture() {
  const previousBlockHash = '12'.repeat(32);
  const merkleRoot = '34'.repeat(32);
  const header = Buffer.alloc(80);
  header.writeInt32LE(1, 0);
  Buffer.from(previousBlockHash, 'hex').reverse().copy(header, 4);
  Buffer.from(merkleRoot, 'hex').reverse().copy(header, 36);
  header.writeUInt32LE(Math.floor(Date.now() / 1000), 68);
  const job = {
    id: 'synthetic-job',
    previousBlockHash,
    merkleRoot,
    shareTarget: 'ff'.repeat(32),
    expiresAt: new Date(Date.now() + 60_000).toISOString(),
  };
  return { headerHex: header.toString('hex'), job };
}

test('share must commit to the registered job', () => {
  const { headerHex, job } = workFixture();
  const share = verifyWorkShare({ headerHex, job });
  assert.match(share.shareId, /^[0-9a-f]{64}$/);
  assert.equal(share.workUnits, '1');
  assert.throws(() => verifyWorkShare({ headerHex, job: { ...job, merkleRoot: '56'.repeat(32) } }), /registered job/);
});

test('Proof-of-Help receipt is signed, chained and duplicate-resistant', async () => {
  const { privateKey, publicKey } = crypto.generateKeyPairSync('ed25519');
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'rescuemesh-ledger-'));
  const ledger = new HelpLedger({ filePath: path.join(directory, 'ledger.ndjson'), privateKey, publicKey });
  await ledger.initialize();
  const { headerHex, job } = workFixture();
  ledger.registerJob(job);
  const receipt = await ledger.acceptShare({ jobId: job.id, subject: 'synthetic-miner', headerHex });
  assert.equal(verifyHelpReceipt(receipt).valid, true);
  await assert.rejects(() => ledger.acceptShare({ jobId: job.id, subject: 'synthetic-miner', headerHex }), /Duplicate/);
  const restarted = new HelpLedger({ filePath: path.join(directory, 'ledger.ndjson'), privateKey, publicKey });
  await restarted.initialize();
  restarted.registerJob(job);
  await assert.rejects(() => restarted.acceptShare({ jobId: job.id, subject: 'synthetic-miner', headerHex }), /Duplicate/);
});
