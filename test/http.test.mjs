import assert from 'node:assert/strict';
import test from 'node:test';
import { once } from 'node:events';
import { PublicJobStore } from '../src/coordinator/job-store.mjs';
import { AnnouncementRegistry } from '../src/discovery/registry.mjs';
import { createApiServer } from '../src/http/server.mjs';

async function fixture() {
  const config = {
    network: 'regtest',
    api: { host: '127.0.0.1', port: 0, maxBodyBytes: 32768, requestsPerMinute: 1000 },
    discovery: { enabled: false },
  };
  const server = createApiServer({
    config,
    registry: new AnnouncementRegistry({ minimumPowBits: 4, allowLocal: true }),
    jobs: new PublicJobStore(),
    apiToken: 'a'.repeat(32),
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  return { server, base: `http://127.0.0.1:${server.address().port}` };
}

test('health endpoint exposes safety state but no credentials', async (t) => {
  const { server, base } = await fixture();
  t.after(() => server.close());
  const response = await fetch(`${base}/health`);
  const body = await response.json();
  assert.equal(body.mainnetLocked, true);
  assert.equal(body.rawTransactionHttp, false);
  assert.equal(JSON.stringify(body).includes('token'), false);
  assert.equal(response.headers.get('content-security-policy').includes("default-src 'self'"), true);
});

test('public API rejects sensitive fields before storing jobs', async (t) => {
  const { server, base } = await fixture();
  t.after(() => server.close());
  const response = await fetch(`${base}/v1/jobs`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${'a'.repeat(32)}` },
    body: JSON.stringify({ id: 'bad-job', rawTransaction: '00' }),
  });
  assert.equal(response.status, 400);
  assert.match((await response.json()).message, /Sensitive field/);
});

test('job writes require authorization and store only public aggregates', async (t) => {
  const { server, base } = await fixture();
  t.after(() => server.close());
  const body = {
    id: 'public-job',
    bundleCommitment: '11'.repeat(32),
    totalVsize: 100,
    totalFeesSats: 100,
    minimumMinerGainSats: 0,
    capabilities: ['sealed'],
    expiresAt: new Date(Date.now() + 60_000).toISOString(),
  };
  assert.equal((await fetch(`${base}/v1/jobs`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })).status, 401);
  const accepted = await fetch(`${base}/v1/jobs`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${'a'.repeat(32)}` },
    body: JSON.stringify(body),
  });
  assert.equal(accepted.status, 201);
  const listed = await (await fetch(`${base}/v1/jobs`)).json();
  assert.equal(listed.jobs.length, 1);
});
