import assert from 'node:assert/strict';
import test from 'node:test';
import { buildSealedBundle, verifyBundleOpening } from '../src/protocol/bundle.mjs';
import { merkleRootFromTxids } from '../src/protocol/merkle.mjs';

const A = '11'.repeat(32);
const B = '22'.repeat(32);

test('single transaction merkle root is its txid', () => {
  assert.equal(merkleRootFromTxids([A]), A);
});

test('sealed bundle exposes aggregate economics but opens verifiably', () => {
  const bundle = buildSealedBundle({
    id: 'synthetic-bundle',
    expiresAt: new Date(Date.now() + 60_000).toISOString(),
    salt: Buffer.alloc(32, 7),
    transactions: [
      { role: 'rescue', txid: A, feeSats: 100, vsize: 100 },
      { role: 'sponsor', txid: B, feeSats: 900, vsize: 100 },
    ],
  });
  assert.equal(bundle.publicEnvelope.totalFeesSats, 1000);
  assert.equal(bundle.publicEnvelope.transactionCount, 2);
  assert.equal('transactions' in bundle.publicEnvelope, false);
  assert.notEqual(bundle.publicEnvelope.sealedSetRoot, A);
  assert.equal(verifyBundleOpening(bundle.publicEnvelope, bundle.privateManifest), true);
  bundle.privateManifest.transactions[0].feeSats += 1;
  assert.equal(verifyBundleOpening(bundle.publicEnvelope, bundle.privateManifest), false);
});

test('a single sealed transaction does not expose its txid as the set root', () => {
  const bundle = buildSealedBundle({
    id: 'single-private-item',
    expiresAt: new Date(Date.now() + 60_000).toISOString(),
    salt: Buffer.alloc(32, 9),
    transactions: [{ role: 'rescue', txid: A, feeSats: 100, vsize: 100 }],
  });
  assert.notEqual(bundle.publicEnvelope.sealedSetRoot, A);
  assert.equal(JSON.stringify(bundle.publicEnvelope).includes(A), false);
});
