import crypto from 'node:crypto';
import { canonicalBytes } from './canonical-json.mjs';

export function sha256(value) {
  return crypto.createHash('sha256').update(value).digest();
}

export function hash256(value) {
  return sha256(sha256(value));
}

export function objectDigest(value) {
  return sha256(canonicalBytes(value)).toString('hex');
}

export function timingSafeEqualHex(left, right) {
  if (typeof left !== 'string' || typeof right !== 'string') return false;
  if (!/^[0-9a-f]*$/i.test(left) || !/^[0-9a-f]*$/i.test(right)) return false;
  const a = Buffer.from(left, 'hex');
  const b = Buffer.from(right, 'hex');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export function randomId(bytes = 16) {
  return crypto.randomBytes(bytes).toString('hex');
}

export function countLeadingZeroBits(buffer) {
  let bits = 0;
  for (const byte of buffer) {
    if (byte === 0) {
      bits += 8;
      continue;
    }
    for (let mask = 0x80; mask > 0 && (byte & mask) === 0; mask >>= 1) bits += 1;
    break;
  }
  return bits;
}
