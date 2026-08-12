import assert from 'node:assert/strict';
import test from 'node:test';
import { parseTransactionHex } from '../src/bitcoin/transaction.mjs';

const LEGACY = [
  '01000000',
  '01',
  '00'.repeat(32),
  'ffffffff',
  '00',
  'ffffffff',
  '01',
  '0000000000000000',
  '00',
  '00000000',
].join('');

const SEGWIT = [
  '02000000',
  '0001',
  '01',
  '11'.repeat(32),
  '00000000',
  '00',
  'feffffff',
  '01',
  '0100000000000000',
  '00',
  '01',
  '01',
  '00',
  '00000000',
].join('');

test('bounded parser summarizes a legacy transaction without retaining scripts', () => {
  const transaction = parseTransactionHex(LEGACY);
  assert.equal(transaction.hasWitness, false);
  assert.equal(transaction.inputCount, 1);
  assert.equal(transaction.outputCount, 1);
  assert.equal(transaction.vsize, transaction.size);
  assert.equal('raw' in transaction, false);
  assert.equal('script' in transaction.inputs[0], false);
});

test('bounded parser computes different txid and wtxid for witness data', () => {
  const transaction = parseTransactionHex(SEGWIT);
  assert.equal(transaction.hasWitness, true);
  assert.notEqual(transaction.txid, transaction.wtxid);
  assert.equal(transaction.inputs[0].witnessItemCount, 1);
  assert.equal(transaction.outputValueSats, '1');
});

test('non-canonical CompactSize is rejected', () => {
  const malformed = `01000000fd0100${LEGACY.slice(10)}`;
  assert.throws(() => parseTransactionHex(malformed), /non-canonical/);
});

test('superfluous witness serialization is rejected', () => {
  const emptyWitness = SEGWIT.replace('010100000000', '0000000000');
  assert.throws(() => parseTransactionHex(emptyWitness));
});
