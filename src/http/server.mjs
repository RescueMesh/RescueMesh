import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { evaluateRescueCandidate } from '../economics/scheduler.mjs';
import { rejectSensitiveKeys } from '../lib/validation.mjs';

const WEB_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../web');
const STATIC_FILES = new Map([
  ['/', ['index.html', 'text/html; charset=utf-8']],
  ['/app.js', ['app.js', 'text/javascript; charset=utf-8']],
  ['/styles.css', ['styles.css', 'text/css; charset=utf-8']],
]);

function securityHeaders(contentType = 'application/json; charset=utf-8') {
  return {
    'content-type': contentType,
    'cache-control': 'no-store',
    'content-security-policy': "default-src 'self'; connect-src 'self'; img-src 'self'; style-src 'self'; script-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
    'referrer-policy': 'no-referrer',
    'x-content-type-options': 'nosniff',
    'x-frame-options': 'DENY',
    'permissions-policy': 'camera=(), microphone=(), geolocation=(), payment=(), usb=()',
    'cross-origin-resource-policy': 'same-origin',
  };
}

function writeJson(response, status, payload) {
  response.writeHead(status, securityHeaders());
  response.end(`${JSON.stringify(payload)}\n`);
}

async function readJson(request, maximumBytes) {
  const contentType = String(request.headers['content-type'] || '').split(';', 1)[0].trim();
  if (contentType !== 'application/json') throw Object.assign(new Error('Content-Type must be application/json'), { statusCode: 415 });
  const chunks = [];
  let length = 0;
  for await (const chunk of request) {
    length += chunk.length;
    if (length > maximumBytes) throw Object.assign(new Error('Request body is too large'), { statusCode: 413 });
    chunks.push(chunk);
  }
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); }
  catch { throw Object.assign(new Error('Invalid JSON body'), { statusCode: 400 }); }
}

function safeTokenMatch(provided, expected) {
  if (!provided || !expected) return false;
  const left = Buffer.from(provided);
  const right = Buffer.from(expected);
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}

function requireWriteToken(request, token) {
  const header = String(request.headers.authorization || '');
  const provided = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (!safeTokenMatch(provided, token)) throw Object.assign(new Error('Write authorization required'), { statusCode: 401 });
}

function createRateLimiter(maximumPerMinute) {
  const clients = new Map();
  return (address, now = Date.now()) => {
    const key = address || 'unknown';
    const state = clients.get(key);
    if (!state || now - state.startedAt >= 60_000) {
      clients.set(key, { startedAt: now, count: 1 });
      return true;
    }
    state.count += 1;
    return state.count <= maximumPerMinute;
  };
}

export function createApiServer({ config, registry, jobs, apiToken, version = '0.1.0' }) {
  if (!apiToken || apiToken.length < 32) throw new Error('API token must contain at least 32 characters');
  const allowRequest = createRateLimiter(config.api.requestsPerMinute);
  const startedAt = Date.now();

  return http.createServer(async (request, response) => {
    try {
      if (!allowRequest(request.socket.remoteAddress)) {
        writeJson(response, 429, { error: 'RATE_LIMITED' });
        return;
      }
      const url = new URL(request.url, 'http://localhost');
      if (request.method === 'GET' && STATIC_FILES.has(url.pathname)) {
        const [fileName, contentType] = STATIC_FILES.get(url.pathname);
        const body = await fs.readFile(path.join(WEB_ROOT, fileName));
        response.writeHead(200, securityHeaders(contentType));
        response.end(body);
        return;
      }
      if (request.method === 'GET' && url.pathname === '/health') {
        writeJson(response, 200, {
          status: 'ok',
          version,
          network: config.network,
          mainnetLocked: config.network !== 'mainnet',
          rawTransactionHttp: false,
          discoveryEnabled: config.discovery.enabled,
          announcements: registry.list().length,
          publicJobs: jobs.list().length,
          uptimeSeconds: Math.floor((Date.now() - startedAt) / 1000),
        });
        return;
      }
      if (request.method === 'GET' && url.pathname === '/v1/capabilities') {
        writeJson(response, 200, {
          capabilities: ['sealed-jobs', 'proof-of-help', 'marginal-scheduler', 'signed-gossip'],
          limitations: ['no-mainnet-broadcaster', 'no-raw-http', 'no-custody'],
        });
        return;
      }
      if (request.method === 'GET' && url.pathname === '/v1/announcements') {
        writeJson(response, 200, { announcements: registry.list() });
        return;
      }
      if (request.method === 'POST' && url.pathname === '/v1/announcements') {
        const body = await readJson(request, config.api.maxBodyBytes);
        rejectSensitiveKeys(body);
        const result = registry.accept(body);
        writeJson(response, 202, result);
        return;
      }
      if (request.method === 'GET' && url.pathname === '/v1/jobs') {
        writeJson(response, 200, { jobs: jobs.list() });
        return;
      }
      if (request.method === 'POST' && url.pathname === '/v1/jobs') {
        requireWriteToken(request, apiToken);
        const body = await readJson(request, config.api.maxBodyBytes);
        rejectSensitiveKeys(body);
        writeJson(response, 201, { job: jobs.add(body) });
        return;
      }
      if (request.method === 'POST' && url.pathname === '/v1/simulate') {
        const body = await readJson(request, config.api.maxBodyBytes);
        rejectSensitiveKeys(body);
        writeJson(response, 200, { evaluation: evaluateRescueCandidate(body) });
        return;
      }
      writeJson(response, 404, { error: 'NOT_FOUND' });
    } catch (error) {
      const status = Number.isInteger(error.statusCode) ? error.statusCode : 400;
      writeJson(response, status, { error: status >= 500 ? 'INTERNAL_ERROR' : 'REQUEST_REJECTED', message: error.message });
    }
  });
}

export async function listenApi(server, config) {
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(config.api.port, config.api.host, () => {
      server.removeListener('error', reject);
      resolve(server.address());
    });
  });
}
