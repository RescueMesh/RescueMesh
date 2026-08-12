import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import test from 'node:test';
import { combineShares, parseShare, serializeShare, splitSecret } from '../src/security/threshold.mjs';

test('any threshold subset reconstructs the secret', () => {
  const secret = crypto.randomBytes(32);
  const shares = splitSecret(secret, { threshold: 3, shares: 5, setId: 'synthetic-set' });
  assert.deepEqual(combineShares([shares[0], shares[2], shares[4]]), secret);
  assert.deepEqual(combineShares([shares[1], shares[2], shares[3]]), secret);
});

test('fewer than threshold shares are rejected', () => {
  const shares = splitSecret(crypto.randomBytes(32), { threshold: 3, shares: 5 });
  assert.throws(() => combineShares(shares.slice(0, 2)), /At least 3/);
});

test('threshold shares are self-checking and cannot be mixed', () => {
  const first = splitSecret(crypto.randomBytes(32), { threshold: 2, shares: 3 });
  const second = splitSecret(crypto.randomBytes(32), { threshold: 2, shares: 3 });
  assert.throws(() => combineShares([first[0], second[1]]), /different sets/);
  const tampered = { ...first[0], payload: Buffer.alloc(32).toString('base64') };
  assert.throws(() => combineShares([tampered, first[1]]), /checksum/);
});

test('serialized share round-trips without exposing raw JSON', () => {
  const share = splitSecret(crypto.randomBytes(32), { threshold: 2, shares: 2 })[0];
  const encoded = serializeShare(share);
  assert.equal(encoded.includes('payload'), false);
  assert.deepEqual(parseShare(encoded), share);
});
