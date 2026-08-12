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
  ['/en', ['en.html', 'text/html; charset=utf-8']],
  ['/en/', ['en.html', 'text/html; charset=utf-8']],
  ['/app.js', ['app.js', 'text/javascript; charset=utf-8']],
  ['/styles.css', ['styles.css', 'text/css; charset=utf-8']],
  ['/brand.png', ['brand.png', 'image/png']],
  ['/og.png', ['og.png', 'image/png']],
  ['/og-en.png', ['og-en.png', 'image/png']],
]);
const KNOWN_PATHS = new Set([
  ...STATIC_FILES.keys(),
  '/health',
  '/v1/capabilities',
  '/v1/announcements',
  '/v1/jobs',
  '/v1/simulate',
]);
const LOOPBACK_HOSTS = new Set(['127.0.0.1', 'localhost', '[::1]']);

function securityHeaders(contentType = 'application/json; charset=utf-8') {
  return {
    'content-type': contentType,
    'cache-control': 'no-store',
    'content-security-policy': "default-src 'none'; connect-src 'self'; font-src 'self'; img-src 'self'; style-src 'self'; script-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'; object-src 'none'; media-src 'none'; worker-src 'none'; manifest-src 'self'",
    'referrer-policy': 'no-referrer',
    'x-content-type-options': 'nosniff',
    'x-frame-options': 'DENY',
    'x-permitted-cross-domain-policies': 'none',
    'x-xss-protection': '0',
    'permissions-policy': 'accelerometer=(), ambient-light-sensor=(), autoplay=(), camera=(), display-capture=(), encrypted-media=(), fullscreen=(), geolocation=(), gyroscope=(), magnetometer=(), microphone=(), midi=(), payment=(), picture-in-picture=(), publickey-credentials-get=(), screen-wake-lock=(), serial=(), sync-xhr=(), usb=(), web-share=(), xr-spatial-tracking=()',
    'cross-origin-opener-policy': 'same-origin',
    'cross-origin-embedder-policy': 'require-corp',
    'cross-origin-resource-policy': 'same-origin',
    'origin-agent-cluster': '?1',
  };
}

function writeJson(response, status, payload) {
  const body = `${JSON.stringify(payload)}\n`;
  response.writeHead(status, securityHeaders());
  response.end(body);
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

function requestHostname(request) {
  const host = String(request.headers.host || '');
  try { return new URL(`http://${host}`).hostname.toLowerCase(); }
  catch { return ''; }
}

function enforceBrowserBoundary(request) {
  if (!LOOPBACK_HOSTS.has(requestHostname(request))) {
    throw Object.assign(new Error('Untrusted Host header'), { statusCode: 421, errorCode: 'UNTRUSTED_HOST' });
  }
  const fetchSite = String(request.headers['sec-fetch-site'] || '').toLowerCase();
  if (fetchSite === 'cross-site') {
    throw Object.assign(new Error('Cross-site browser request blocked'), { statusCode: 403, errorCode: 'CROSS_SITE_BLOCKED' });
  }
  if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method)) return;
  const origin = String(request.headers.origin || '');
  if (!origin) return;
  try {
    const parsed = new URL(origin);
    if (parsed.protocol !== 'http:' || parsed.host !== request.headers.host) throw new Error('mismatch');
  } catch {
    throw Object.assign(new Error('Cross-origin mutation blocked'), { statusCode: 403, errorCode: 'CROSS_ORIGIN_BLOCKED' });
  }
}

function publicError(error) {
  const status = Number.isInteger(error.statusCode) ? error.statusCode : error instanceof TypeError ? 400 : 500;
  const defaults = {
    400: ['REQUEST_REJECTED', 'La solicitud no cumple el formato permitido.'],
    401: ['AUTHORIZATION_REQUIRED', 'Se requiere autorización para esta operación.'],
    403: ['REQUEST_BLOCKED', 'La solicitud ha sido bloqueada por la política de seguridad.'],
    405: ['METHOD_NOT_ALLOWED', 'El método HTTP no está permitido para este recurso.'],
    413: ['BODY_TOO_LARGE', 'El cuerpo de la solicitud supera el límite permitido.'],
    415: ['UNSUPPORTED_MEDIA_TYPE', 'El cuerpo debe usar application/json.'],
    421: ['UNTRUSTED_HOST', 'El encabezado Host no pertenece a la interfaz local.'],
    429: ['RATE_LIMITED', 'Se ha alcanzado el límite temporal de solicitudes.'],
    500: ['INTERNAL_ERROR', 'El servicio no pudo completar la solicitud.'],
  };
  const [defaultCode, message] = defaults[status] || defaults[500];
  return { status, payload: { error: error.errorCode || defaultCode, message } };
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
      enforceBrowserBoundary(request);
      if (!allowRequest(request.socket.remoteAddress)) {
        writeJson(response, 429, { error: 'RATE_LIMITED' });
        return;
      }
      const url = new URL(request.url, 'http://localhost');
      if (request.method === 'GET' && STATIC_FILES.has(url.pathname)) {
        const [fileName, contentType] = STATIC_FILES.get(url.pathname);
        const body = await fs.readFile(path.join(WEB_ROOT, fileName));
        const headers = securityHeaders(contentType);
        if (fileName === 'index.html') headers['content-language'] = 'es';
        if (fileName === 'en.html') headers['content-language'] = 'en';
        response.writeHead(200, headers);
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
      if (KNOWN_PATHS.has(url.pathname)) {
        response.setHeader('allow', url.pathname === '/v1/announcements' || url.pathname === '/v1/jobs' ? 'GET, POST' : url.pathname === '/v1/simulate' ? 'POST' : 'GET');
        writeJson(response, 405, { error: 'METHOD_NOT_ALLOWED', message: 'El método HTTP no está permitido para este recurso.' });
        return;
      }
      writeJson(response, 404, { error: 'NOT_FOUND' });
    } catch (error) {
      const { status, payload } = publicError(error);
      writeJson(response, status, payload);
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
