import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import test from 'node:test';
import { mineAnnouncement, verifyAnnouncement } from '../src/protocol/announcement.mjs';
import { AnnouncementRegistry } from '../src/discovery/registry.mjs';

function fixture(now = Date.now()) {
  const { privateKey, publicKey } = crypto.generateKeyPairSync('ed25519');
  return mineAnnouncement({
    privateKey,
    publicKey,
    endpoint: 'http://127.0.0.1:39393',
    capabilities: ['sealed-jobs', 'proof-of-help'],
    policyDigest: 'ab'.repeat(32),
    ttlSeconds: 300,
    powBits: 4,
    now,
    allowLocal: true,
  });
}

test('signed proof-of-work announcement verifies and registers', () => {
  const now = Date.now();
  const record = fixture(now);
  assert.equal(verifyAnnouncement(record, { minimumPowBits: 4, now, allowLocal: true }).valid, true);
  const registry = new AnnouncementRegistry({ minimumPowBits: 4, allowLocal: true });
  registry.accept(record, now);
  assert.equal(registry.list(now).length, 1);
});

test('tampering invalidates the discovery signature', () => {
  const now = Date.now();
  const record = fixture(now);
  record.capabilities.push('datum');
  assert.throws(() => verifyAnnouncement(record, { minimumPowBits: 4, now, allowLocal: true }));
});

test('expired announcement is rejected', () => {
  const issued = Date.now() - 600_000;
  const record = fixture(issued);
  assert.throws(() => verifyAnnouncement(record, { minimumPowBits: 4, now: Date.now(), allowLocal: true }), /expired/);
});
