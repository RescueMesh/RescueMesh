import assert from 'node:assert/strict';
import test from 'node:test';
import { scanFile } from '../scripts/scan-secrets.mjs';

test('secret scanner inspects size and content through one stable file handle', async () => {
  const calls = [];
  const handle = {
    async stat() {
      calls.push('stat');
      return { isFile: () => true, size: 16 };
    },
    async readFile(options) {
      calls.push(['readFile', options]);
      return 'ordinary public text';
    },
    async close() {
      calls.push('close');
    },
  };

  const findings = await scanFile('ignored-path', 'safe.txt', {
    openFile: async (file, flags) => {
      calls.push(['open', file, flags]);
      return handle;
    },
  });

  assert.deepEqual(findings, []);
  assert.deepEqual(calls.map((call) => Array.isArray(call) ? call[0] : call), ['open', 'stat', 'readFile', 'close']);
  assert.equal(calls[2][1].encoding, 'utf8');
});

test('secret scanner fails closed when a repository file cannot be opened', async () => {
  const denied = Object.assign(new Error('denied'), { code: 'EACCES' });
  const findings = await scanFile('ignored-path', 'blocked.txt', {
    openFile: async () => { throw denied; },
  });

  assert.deepEqual(findings, ['blocked.txt: could not be scanned (EACCES)']);
});

test('secret scanner closes oversized files without reading them', async () => {
  let read = false;
  let closed = false;
  const findings = await scanFile('ignored-path', 'oversized.bin', {
    openFile: async () => ({
      async stat() { return { isFile: () => true, size: 2_000_001 }; },
      async readFile() { read = true; return ''; },
      async close() { closed = true; },
    }),
  });

  assert.equal(read, false);
  assert.equal(closed, true);
  assert.deepEqual(findings, ['oversized.bin: unexpectedly large repository file (2000001 bytes)']);
});
