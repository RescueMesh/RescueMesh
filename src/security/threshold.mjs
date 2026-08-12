import crypto from 'node:crypto';
import { canonicalBytes } from '../lib/canonical-json.mjs';
import { objectDigest, randomId } from '../lib/crypto.mjs';

function gfMultiply(left, right) {
  let a = left;
  let b = right;
  let result = 0;
  while (b > 0) {
    if (b & 1) result ^= a;
    const carry = a & 0x80;
    a = (a << 1) & 0xff;
    if (carry) a ^= 0x1b;
    b >>= 1;
  }
  return result;
}

function gfPower(value, exponent) {
  let result = 1;
  let base = value;
  let power = exponent;
  while (power > 0) {
    if (power & 1) result = gfMultiply(result, base);
    base = gfMultiply(base, base);
    power >>= 1;
  }
  return result;
}

function gfInverse(value) {
  if (value === 0) throw new Error('Cannot invert zero in GF(256)');
  return gfPower(value, 254);
}

function evaluatePolynomial(coefficients, x) {
  let result = 0;
  for (let index = coefficients.length - 1; index >= 0; index -= 1) {
    result = gfMultiply(result, x) ^ coefficients[index];
  }
  return result;
}

function unsignedShare(share) {
  const { checksum, ...unsigned } = share;
  return unsigned;
}

export function splitSecret(secretValue, { threshold, shares, setId = randomId(16) }) {
  const secret = Buffer.from(secretValue);
  if (secret.length < 16 || secret.length > 4096) throw new Error('Threshold secret must contain 16 to 4096 bytes');
  if (!Number.isInteger(threshold) || threshold < 2 || threshold > 255) throw new Error('Threshold must be between 2 and 255');
  if (!Number.isInteger(shares) || shares < threshold || shares > 255) throw new Error('Share count must be between threshold and 255');
  const outputs = Array.from({ length: shares }, (_, index) => Buffer.alloc(secret.length));
  for (let byteIndex = 0; byteIndex < secret.length; byteIndex += 1) {
    const coefficients = Buffer.concat([Buffer.from([secret[byteIndex]]), crypto.randomBytes(threshold - 1)]);
    for (let shareIndex = 0; shareIndex < shares; shareIndex += 1) {
      outputs[shareIndex][byteIndex] = evaluatePolynomial(coefficients, shareIndex + 1);
    }
  }
  return outputs.map((payload, index) => {
    const share = {
      schema: 'rescuemesh/threshold-share/v1',
      setId,
      threshold,
      totalShares: shares,
      x: index + 1,
      payload: payload.toString('base64'),
    };
    return Object.freeze({ ...share, checksum: objectDigest(share) });
  });
}

export function combineShares(values) {
  if (!Array.isArray(values) || values.length < 2) throw new Error('At least two threshold shares are required');
  const parsed = values.map((value) => {
    if (!value || value.schema !== 'rescuemesh/threshold-share/v1') throw new Error('Unsupported threshold share');
    if (value.checksum !== objectDigest(unsignedShare(value))) throw new Error('Threshold share checksum is invalid');
    return { ...value, bytes: Buffer.from(value.payload, 'base64') };
  });
  const first = parsed[0];
  if (parsed.length < first.threshold) throw new Error(`At least ${first.threshold} shares are required`);
  if (parsed.some((share) => share.setId !== first.setId || share.threshold !== first.threshold || share.totalShares !== first.totalShares || share.bytes.length !== first.bytes.length)) {
    throw new Error('Threshold shares belong to different sets');
  }
  if (new Set(parsed.map((share) => share.x)).size !== parsed.length) throw new Error('Duplicate threshold share index');
  const selected = parsed.slice(0, first.threshold);
  const secret = Buffer.alloc(first.bytes.length);
  for (let byteIndex = 0; byteIndex < secret.length; byteIndex += 1) {
    let value = 0;
    for (let i = 0; i < selected.length; i += 1) {
      let basis = 1;
      for (let j = 0; j < selected.length; j += 1) {
        if (i === j) continue;
        basis = gfMultiply(basis, gfMultiply(selected[j].x, gfInverse(selected[i].x ^ selected[j].x)));
      }
      value ^= gfMultiply(selected[i].bytes[byteIndex], basis);
    }
    secret[byteIndex] = value;
  }
  return secret;
}

export function serializeShare(share) {
  return `${canonicalBytes(share).toString('base64url')}\n`;
}

export function parseShare(text) {
  let share;
  try { share = JSON.parse(Buffer.from(String(text).trim(), 'base64url').toString('utf8')); }
  catch { throw new Error('Threshold share encoding is invalid'); }
  if (share.checksum !== objectDigest(unsignedShare(share))) throw new Error('Threshold share checksum is invalid');
  return Object.freeze(share);
}
