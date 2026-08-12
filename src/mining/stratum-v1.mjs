import crypto from 'node:crypto';
import net from 'node:net';

const LOOPBACK = new Set(['127.0.0.1', '::1', 'localhost']);

function send(socket, payload) {
  if (!socket.destroyed) socket.write(`${JSON.stringify(payload)}\n`);
}

function reply(socket, id, result, error = null) {
  send(socket, { id, result, error });
}

function validateMinerName(value) {
  const name = String(value || '').trim();
  if (name.length < 3 || name.length > 128 || /[\x00-\x1f\x7f]/.test(name)) throw new Error('Invalid miner identity');
  return name;
}

/**
 * Loopback-only Stratum V1 compatibility adapter. Remote access must be
 * provided by an authenticated encrypted tunnel such as Tor; plaintext
 * Stratum is never bound directly to a public interface.
 */
export async function startStratumV1({
  host = '127.0.0.1',
  port = 39394,
  difficulty = 1,
  maximumClients = 32,
  maximumLineBytes = 65536,
  messagesPerMinute = 600,
  createJob,
  submitShare,
  onEvent = () => {},
}) {
  if (!LOOPBACK.has(host)) throw new Error('Stratum V1 must bind to loopback');
  if (typeof createJob !== 'function' || typeof submitShare !== 'function') throw new Error('Stratum job handlers are required');
  if (!Number.isFinite(difficulty) || difficulty <= 0) throw new Error('Invalid Stratum difficulty');
  const sessions = new Set();

  async function issueJob(session, cleanJobs = true) {
    const job = await createJob({ miner: session.miner, extranonce1: session.extranonce1, extranonce2Size: 8 });
    if (!job || typeof job.id !== 'string' || !Array.isArray(job.notification)) throw new Error('Job factory returned an invalid public job');
    session.jobs.set(job.id, job);
    while (session.jobs.size > 8) session.jobs.delete(session.jobs.keys().next().value);
    send(session.socket, { id: null, method: 'mining.notify', params: [...job.notification.slice(0, -1), cleanJobs] });
  }

  async function handle(session, message) {
    if (!message || typeof message !== 'object' || typeof message.method !== 'string') throw new Error('Invalid Stratum JSON-RPC message');
    const params = Array.isArray(message.params) ? message.params : [];
    if (message.method === 'mining.subscribe') {
      session.subscribed = true;
      reply(session.socket, message.id, [[['mining.notify', session.subscriptionId]], session.extranonce1, 8]);
      return;
    }
    if (message.method === 'mining.authorize') {
      if (!session.subscribed) { reply(session.socket, message.id, false, [24, 'Subscribe first', null]); return; }
      session.miner = validateMinerName(params[0]);
      session.authorized = true;
      reply(session.socket, message.id, true);
      send(session.socket, { id: null, method: 'mining.set_difficulty', params: [difficulty] });
      await issueJob(session, true);
      onEvent({ type: 'authorized', at: new Date().toISOString(), miner: session.miner });
      return;
    }
    if (message.method === 'mining.submit') {
      if (!session.authorized) { reply(session.socket, message.id, false, [24, 'Authorize first', null]); return; }
      const [miner, jobId, extranonce2, ntime, nonce] = params;
      if (miner !== session.miner) { reply(session.socket, message.id, false, [24, 'Miner identity mismatch', null]); return; }
      const job = session.jobs.get(String(jobId));
      if (!job) { reply(session.socket, message.id, false, [21, 'Unknown or expired job', null]); return; }
      const result = await submitShare({ job, miner: session.miner, extranonce2, ntime, nonce });
      if (!result?.accepted) { reply(session.socket, message.id, false, [23, result?.reason || 'Low difficulty share', null]); return; }
      reply(session.socket, message.id, true);
      onEvent({ type: 'share-accepted', at: new Date().toISOString(), miner: session.miner, networkCandidate: result.networkCandidate === true });
      return;
    }
    if (message.method === 'mining.configure') { reply(session.socket, message.id, {}); return; }
    if (message.method === 'mining.extranonce.subscribe') { reply(session.socket, message.id, true); return; }
    if (message.method === 'client.get_version') { reply(session.socket, message.id, 'RescueMesh/0.1'); return; }
    reply(session.socket, message.id, null, [20, 'Unsupported method', null]);
  }

  const server = net.createServer((socket) => {
    if (sessions.size >= maximumClients) {
      socket.end(`${JSON.stringify({ id: null, result: null, error: [20, 'Server capacity reached', null] })}\n`);
      return;
    }
    socket.setNoDelay(true);
    socket.setKeepAlive(true, 30_000);
    const session = {
      socket,
      buffer: '',
      subscribed: false,
      authorized: false,
      miner: null,
      extranonce1: crypto.randomBytes(4).toString('hex'),
      subscriptionId: crypto.randomBytes(8).toString('hex'),
      jobs: new Map(),
      queue: Promise.resolve(),
      windowStartedAt: Date.now(),
      messageCount: 0,
    };
    sessions.add(session);
    socket.on('data', (chunk) => {
      session.buffer += chunk.toString('utf8');
      if (Buffer.byteLength(session.buffer, 'utf8') > maximumLineBytes) {
        socket.destroy(new Error('Stratum line limit exceeded'));
        return;
      }
      const lines = session.buffer.split('\n');
      session.buffer = lines.pop();
      for (const rawLine of lines) {
        const line = rawLine.trim();
        if (!line) continue;
        const now = Date.now();
        if (now - session.windowStartedAt >= 60_000) {
          session.windowStartedAt = now;
          session.messageCount = 0;
        }
        session.messageCount += 1;
        if (session.messageCount > messagesPerMinute) {
          socket.destroy(new Error('Stratum message rate exceeded'));
          break;
        }
        session.queue = session.queue.then(async () => {
          let message;
          try { message = JSON.parse(line); }
          catch { throw new Error('Invalid Stratum JSON'); }
          await handle(session, message);
        }).catch((error) => {
          send(socket, { id: null, result: null, error: [20, error.message, null] });
        });
      }
    });
    socket.on('close', () => sessions.delete(session));
    socket.on('error', () => {});
  });

  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, host, () => { server.removeListener('error', reject); resolve(); });
  });
  return server;
}
