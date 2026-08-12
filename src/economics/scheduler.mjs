import { assertInteger } from '../lib/validation.mjs';

function ceilDiv(numerator, denominator) {
  return (numerator + denominator - 1n) / denominator;
}

/**
 * Evaluate a rescue package using integer milli-satoshis per vbyte.
 * The scheduler is conservative: only the bytes that exceed free blockspace
 * are charged at the marginal market rate.
 */
export function evaluateRescueCandidate(input) {
  const rescueVsize = assertInteger(input.rescueVsize, { label: 'rescueVsize', minimum: 1, maximum: 1000000 });
  const rescueFeeSats = assertInteger(input.rescueFeeSats, { label: 'rescueFeeSats', minimum: 0 });
  const freeSpaceVbytes = assertInteger(input.freeSpaceVbytes ?? 0, { label: 'freeSpaceVbytes', minimum: 0, maximum: 1000000 });
  const marginalRateMilliSatsPerVbyte = assertInteger(input.marginalRateMilliSatsPerVbyte ?? 0, {
    label: 'marginalRateMilliSatsPerVbyte', minimum: 0, maximum: 1000000000,
  });
  const auxiliaryRevenueSats = assertInteger(input.auxiliaryRevenueSats ?? 0, { label: 'auxiliaryRevenueSats', minimum: 0 });
  const infrastructureSavingsSats = assertInteger(input.infrastructureSavingsSats ?? 0, { label: 'infrastructureSavingsSats', minimum: 0 });
  const minimumNetGainSats = assertInteger(input.minimumNetGainSats ?? 0, { label: 'minimumNetGainSats', minimum: 0 });

  const displacedVbytes = Math.max(0, rescueVsize - freeSpaceVbytes);
  const opportunityCostSats = Number(ceilDiv(
    BigInt(displacedVbytes) * BigInt(marginalRateMilliSatsPerVbyte),
    1000n,
  ));
  const grossBenefitSats = rescueFeeSats + auxiliaryRevenueSats + infrastructureSavingsSats;
  assertInteger(grossBenefitSats, { label: 'grossBenefitSats', minimum: 0 });
  const netGainSats = grossBenefitSats - opportunityCostSats;
  const accepted = netGainSats >= minimumNetGainSats;
  const feeRateMilliSatsPerVbyte = Number(
    (BigInt(rescueFeeSats) * 1000n) / BigInt(rescueVsize),
  );
  assertInteger(feeRateMilliSatsPerVbyte, { label: 'feeRateMilliSatsPerVbyte', minimum: 0 });

  return {
    accepted,
    reason: accepted ? 'NON_NEGATIVE_EXPECTED_VALUE' : 'INSUFFICIENT_MINER_VALUE',
    rescueVsize,
    rescueFeeSats,
    feeRateMilliSatsPerVbyte,
    freeSpaceVbytes: Math.min(freeSpaceVbytes, rescueVsize),
    displacedVbytes,
    opportunityCostSats,
    auxiliaryRevenueSats,
    infrastructureSavingsSats,
    grossBenefitSats,
    netGainSats,
    minimumNetGainSats,
    userAdditionalChargeSats: 0,
  };
}

export function rankCandidates(candidates) {
  return candidates
    .map((candidate, index) => ({ index, candidate, evaluation: evaluateRescueCandidate(candidate) }))
    .filter(({ evaluation }) => evaluation.accepted)
    .sort((left, right) => {
      if (right.evaluation.netGainSats !== left.evaluation.netGainSats) {
        return right.evaluation.netGainSats - left.evaluation.netGainSats;
      }
      return left.evaluation.rescueVsize - right.evaluation.rescueVsize;
    });
}
