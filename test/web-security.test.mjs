import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import test from 'node:test';
import { once } from 'node:events';
import { fileURLToPath } from 'node:url';
import { PublicJobStore } from '../src/coordinator/job-store.mjs';
import { AnnouncementRegistry } from '../src/discovery/registry.mjs';
import { createApiServer } from '../src/http/server.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

async function fixture(overrides = {}) {
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
    ...overrides,
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  return { server, port: server.address().port, base: `http://127.0.0.1:${server.address().port}` };
}

function rawRequest(port, { path: requestPath = '/', method = 'GET', headers = {}, body } = {}) {
  return new Promise((resolve, reject) => {
    const request = http.request({ host: '127.0.0.1', port, path: requestPath, method, headers }, (response) => {
      const chunks = [];
      response.on('data', (chunk) => chunks.push(chunk));
      response.on('end', () => resolve({
        status: response.statusCode,
        headers: response.headers,
        body: Buffer.concat(chunks).toString('utf8'),
      }));
    });
    request.once('error', reject);
    if (body) request.write(body);
    request.end();
  });
}

test('Spanish and English pages are separate, local and hardened', async (t) => {
  const { server, base } = await fixture();
  t.after(() => server.close());
  const [spanish, english] = await Promise.all([fetch(`${base}/`), fetch(`${base}/en`)]);
  const [spanishBody, englishBody] = await Promise.all([spanish.text(), english.text()]);

  assert.equal(spanish.status, 200);
  assert.equal(english.status, 200);
  assert.equal(spanish.headers.get('content-language'), 'es');
  assert.equal(english.headers.get('content-language'), 'en');
  assert.match(spanishBody, /Coordinar el rescate/);
  assert.match(englishBody, /Coordinate the rescue/);
  assert.match(spanishBody, /href="\/en"/);
  assert.match(englishBody, /href="\/"/);

  for (const response of [spanish, english]) {
    const csp = response.headers.get('content-security-policy');
    assert.match(csp, /default-src 'none'/);
    assert.match(csp, /object-src 'none'/);
    assert.match(csp, /frame-ancestors 'none'/);
    assert.equal(response.headers.get('cross-origin-opener-policy'), 'same-origin');
    assert.equal(response.headers.get('cross-origin-embedder-policy'), 'require-corp');
    assert.equal(response.headers.get('permissions-policy').includes('camera=()'), true);
  }
});

test('web files contain no inline executable code or third-party resources', async () => {
  const [spanish, english, script, styles] = await Promise.all([
    fs.readFile(path.join(ROOT, 'web/index.html'), 'utf8'),
    fs.readFile(path.join(ROOT, 'web/en.html'), 'utf8'),
    fs.readFile(path.join(ROOT, 'web/app.js'), 'utf8'),
    fs.readFile(path.join(ROOT, 'web/styles.css'), 'utf8'),
  ]);
  for (const page of [spanish, english]) {
    assert.doesNotMatch(page, /<script(?![^>]*\bsrc=)/i);
    assert.doesNotMatch(page, /\son[a-z]+\s*=/i);
    assert.doesNotMatch(page, /https?:\/\//i);
  }
  assert.doesNotMatch(script, /\b(?:eval|Function)\s*\(/);
  assert.doesNotMatch(script, /\.innerHTML\s*=/);
  assert.doesNotMatch(script, /(?:local|session)Storage/);
  assert.doesNotMatch(styles, /@import|url\(\s*["']?https?:/i);
});

test('brand and localized social assets are served with strict MIME handling', async (t) => {
  const { server, base } = await fixture();
  t.after(() => server.close());
  for (const asset of ['/brand.png', '/og.png', '/og-en.png']) {
    const response = await fetch(`${base}${asset}`);
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('content-type'), 'image/png');
    assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
    assert.ok((await response.arrayBuffer()).byteLength > 1000);
  }
});

test('untrusted hosts and cross-site browser requests fail before routing', async (t) => {
  const { server, port } = await fixture();
  t.after(() => server.close());
  const untrustedHost = await rawRequest(port, { headers: { host: 'rescuemesh.invalid' } });
  assert.equal(untrustedHost.status, 421);
  assert.equal(JSON.parse(untrustedHost.body).error, 'UNTRUSTED_HOST');

  const crossSite = await rawRequest(port, {
    path: '/v1/simulate',
    method: 'POST',
    headers: {
      host: `127.0.0.1:${port}`,
      'content-type': 'application/json',
      'content-length': '2',
      'sec-fetch-site': 'cross-site',
    },
    body: '{}',
  });
  assert.equal(crossSite.status, 403);
  assert.equal(JSON.parse(crossSite.body).error, 'CROSS_SITE_BLOCKED');

  const foreignOrigin = await rawRequest(port, {
    path: '/v1/simulate',
    method: 'POST',
    headers: {
      host: `127.0.0.1:${port}`,
      origin: 'https://attacker.invalid',
      'content-type': 'application/json',
      'content-length': '2',
    },
    body: '{}',
  });
  assert.equal(foreignOrigin.status, 403);
  assert.equal(JSON.parse(foreignOrigin.body).error, 'CROSS_ORIGIN_BLOCKED');
});

test('known routes reject unsupported methods explicitly', async (t) => {
  const { server, base } = await fixture();
  t.after(() => server.close());
  const response = await fetch(`${base}/health`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' });
  assert.equal(response.status, 405);
  assert.equal(response.headers.get('allow'), 'GET');
  assert.equal((await response.json()).error, 'METHOD_NOT_ALLOWED');
});

test('unexpected server failures never disclose internal messages', async (t) => {
  const registry = {
    list() { return []; },
    accept() { throw new Error('INTERNAL SECRET MUST NOT LEAK'); },
  };
  const { server, base } = await fixture({ registry });
  t.after(() => server.close());
  const response = await fetch(`${base}/v1/announcements`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: '{}',
  });
  const body = await response.json();
  assert.equal(response.status, 500);
  assert.equal(body.error, 'INTERNAL_ERROR');
  assert.equal(JSON.stringify(body).includes('INTERNAL SECRET'), false);
});
