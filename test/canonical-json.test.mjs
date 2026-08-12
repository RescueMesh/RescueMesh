import assert from 'node:assert/strict';
import test from 'node:test';
import { canonicalJson } from '../src/lib/canonical-json.mjs';

test('canonical JSON sorts object keys recursively', () => {
  assert.equal(canonicalJson({ z: 1, a: { y: 2, b: 3 } }), '{"a":{"b":3,"y":2},"z":1}');
});

test('canonical JSON refuses non-finite numbers', () => {
  assert.throws(() => canonicalJson({ unsafe: Infinity }), /non-finite/);
});
