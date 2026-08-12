import assert from 'node:assert/strict';
import net from 'node:net';
import test from 'node:test';
import { once } from 'node:events';
import { startStratumV1 } from '../src/mining/stratum-v1.mjs';

function jsonClient(port) {
  const socket = net.createConnection({ host: '127.0.0.1', port });
  let buffer = '';
  const messages = [];
  const waiters = [];
  socket.on('data', (chunk) => {
    buffer += chunk.toString('utf8');
    const lines = buffer.split('\n');
    buffer = lines.pop();
    for (const line of lines.filter(Boolean)) {
      messages.push(JSON.parse(line));
      while (waiters.length) waiters.shift()();
    }
  });
  return {
    socket,
    send: (value) => socket.write(`${JSON.stringify(value)}\n`),
    async next(predicate, timeoutMs = 2000) {
      const deadline = Date.now() + timeoutMs;
      while (Date.now() < deadline) {
        const index = messages.findIndex(predicate);
        if (index >= 0) return messages.splice(index, 1)[0];
        await new Promise((resolve, reject) => {
          const timer = setTimeout(() => reject(new Error('Stratum test timeout')), Math.max(1, deadline - Date.now()));
          waiters.push(() => { clearTimeout(timer); resolve(); });
        });
      }
      throw new Error('Stratum test timeout');
    },
  };
}

test('Stratum adapter is loopback-only', async () => {
  await assert.rejects(() => startStratumV1({ host: '0.0.0.0', port: 0, createJob() {}, submitShare() {} }), /loopback/);
});

test('miner subscribes, authorizes and submits only a registered job', async (t) => {
  const events = [];
  const server = await startStratumV1({
    port: 0,
    difficulty: 0.01,
    onEvent: (event) => events.push(event),
    createJob: async () => ({
      id: 'synthetic-job',
      notification: ['synthetic-job', '00'.repeat(32), '00', '00', [], '00000001', '207fffff', '00000000', true],
    }),
    submitShare: async ({ nonce }) => nonce === '00000001'
      ? { accepted: true, networkCandidate: false }
      : { accepted: false, reason: 'synthetic rejection' },
  });
  t.after(() => server.close());
  const client = jsonClient(server.address().port);
  t.after(() => client.socket.destroy());
  await once(client.socket, 'connect');

  client.send({ id: 1, method: 'mining.subscribe', params: [] });
  assert.ok((await client.next((message) => message.id === 1)).result);
  client.send({ id: 2, method: 'mining.authorize', params: ['synthetic-miner', 'ignored'] });
  assert.equal((await client.next((message) => message.id === 2)).result, true);
  assert.equal((await client.next((message) => message.method === 'mining.notify')).params[0], 'synthetic-job');

  client.send({ id: 3, method: 'mining.submit', params: ['synthetic-miner', 'synthetic-job', '00'.repeat(8), '00000000', '00000000'] });
  assert.equal((await client.next((message) => message.id === 3)).result, false);
  client.send({ id: 4, method: 'mining.submit', params: ['synthetic-miner', 'synthetic-job', '00'.repeat(8), '00000000', '00000001'] });
  assert.equal((await client.next((message) => message.id === 4)).result, true);
  assert.equal(events.some((event) => event.type === 'share-accepted'), true);
});
