import assert from 'node:assert/strict';
import test from 'node:test';
import { evaluateRescueCandidate, rankCandidates } from '../src/economics/scheduler.mjs';

test('free marginal space preserves the owner amount and benefits the miner', () => {
  const result = evaluateRescueCandidate({
    rescueVsize: 12318,
    rescueFeeSats: 12318,
    freeSpaceVbytes: 12318,
    marginalRateMilliSatsPerVbyte: 5000,
  });
  assert.equal(result.accepted, true);
  assert.equal(result.opportunityCostSats, 0);
  assert.equal(result.netGainSats, 12318);
  assert.equal(result.userAdditionalChargeSats, 0);
});

test('candidate is rejected when it displaces more valuable transactions', () => {
  const result = evaluateRescueCandidate({
    rescueVsize: 12318,
    rescueFeeSats: 12318,
    freeSpaceVbytes: 0,
    marginalRateMilliSatsPerVbyte: 5000,
  });
  assert.equal(result.accepted, false);
  assert.equal(result.opportunityCostSats, 61590);
  assert.equal(result.netGainSats, -49272);
});

test('auxiliary revenue can make a candidate non-negative without charging its owner', () => {
  const result = evaluateRescueCandidate({
    rescueVsize: 1000,
    rescueFeeSats: 1000,
    freeSpaceVbytes: 0,
    marginalRateMilliSatsPerVbyte: 5000,
    auxiliaryRevenueSats: 4000,
  });
  assert.equal(result.accepted, true);
  assert.equal(result.netGainSats, 0);
  assert.equal(result.userAdditionalChargeSats, 0);
});

test('ranking is deterministic', () => {
  const ranked = rankCandidates([
    { rescueVsize: 100, rescueFeeSats: 200, freeSpaceVbytes: 100 },
    { rescueVsize: 100, rescueFeeSats: 500, freeSpaceVbytes: 100 },
  ]);
  assert.deepEqual(ranked.map((entry) => entry.index), [1, 0]);
});
