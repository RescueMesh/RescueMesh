import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import test from 'node:test';
import { gossipOnce } from '../src/discovery/gossip.mjs';
import { AnnouncementRegistry } from '../src/discovery/registry.mjs';
import { mineAnnouncement } from '../src/protocol/announcement.mjs';

function announcement() {
  const { privateKey, publicKey } = crypto.generateKeyPairSync('ed25519');
  return mineAnnouncement({
    privateKey,
    publicKey,
    endpoint: 'http://127.0.0.1:39393',
    capabilities: ['sealed-jobs'],
    policyDigest: '12'.repeat(32),
    ttlSeconds: 300,
    powBits: 4,
    allowLocal: true,
  });
}

test('gossip pushes and pulls signed public records only', async () => {
  const own = announcement();
  const peer = announcement();
  const requests = [];
  const fakeFetch = async (url, options = {}) => {
    requests.push({ url, method: options.method || 'GET', body: options.body });
    if (options.method === 'POST') return new Response('{}', { status: 202 });
    return new Response(JSON.stringify({ announcements: [peer] }), { status: 200, headers: { 'content-type': 'application/json' } });
  };
  const registry = new AnnouncementRegistry({ minimumPowBits: 4, allowLocal: true });
  const result = await gossipOnce({ registry, seeds: ['http://127.0.0.1:39393'], ownAnnouncement: own, fetchImpl: fakeFetch });
  assert.equal(result[0].ok, true);
  assert.equal(registry.list().length, 1);
  assert.equal(requests.length, 2);
  assert.equal(requests[0].body.includes('raw'), false);
});

test('gossip isolates peer failures', async () => {
  const registry = new AnnouncementRegistry({ minimumPowBits: 4, allowLocal: true });
  const result = await gossipOnce({
    registry,
    seeds: ['http://127.0.0.1:39393'],
    fetchImpl: async () => { throw new Error('synthetic network failure'); },
  });
  assert.equal(result[0].ok, false);
  assert.match(result[0].error, /synthetic/);
});
