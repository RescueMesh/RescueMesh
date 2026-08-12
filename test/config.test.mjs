import assert from 'node:assert/strict';
import test from 'node:test';
import { validateConfig } from '../src/config.mjs';

test('safe defaults are regtest, loopback and mainnet locked', () => {
  const config = validateConfig({});
  assert.equal(config.network, 'regtest');
  assert.equal(config.api.host, '127.0.0.1');
  assert.equal(config.security.allowRawTransactionHttp, false);
  assert.equal(config.mainnet.submissionEnabled, false);
});

test('remote API binding fails closed', () => {
  assert.throws(() => validateConfig({ api: { host: '0.0.0.0' } }), /Remote API binding is blocked/);
});

test('raw transaction HTTP transport cannot be enabled', () => {
  assert.throws(() => validateConfig({ security: { allowRawTransactionHttp: true } }), /non-negotiable/);
});

test('mainnet remains unavailable even when configuration flags are set', () => {
  const previous = process.env.RESCUEMESH_MAINNET_ACK;
  process.env.RESCUEMESH_MAINNET_ACK = 'I_UNDERSTAND_RESCUEMESH_MAINNET_RISK';
  try {
    assert.throws(() => validateConfig({ network: 'mainnet', mainnet: { enabled: true, submissionEnabled: true } }), /not implemented/);
  } finally {
    if (previous === undefined) delete process.env.RESCUEMESH_MAINNET_ACK;
    else process.env.RESCUEMESH_MAINNET_ACK = previous;
  }
});
