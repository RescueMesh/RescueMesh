const SAFE_ID = /^[a-zA-Z0-9][a-zA-Z0-9._-]{0,63}$/;
const HEX_32 = /^[0-9a-f]{64}$/i;

export function assertSafeId(value, label = 'id') {
  if (typeof value !== 'string' || !SAFE_ID.test(value)) {
    throw new TypeError(`${label} must match ${SAFE_ID}`);
  }
  return value;
}

export function assertHex(value, bytes, label = 'hex') {
  const expression = new RegExp(`^[0-9a-fA-F]{${bytes * 2}}$`);
  if (typeof value !== 'string' || !expression.test(value)) {
    throw new TypeError(`${label} must be exactly ${bytes} bytes of hexadecimal data`);
  }
  return value.toLowerCase();
}

export function assertTxid(value, label = 'txid') {
  if (typeof value !== 'string' || !HEX_32.test(value)) {
    throw new TypeError(`${label} must be a 32-byte hexadecimal transaction id`);
  }
  return value.toLowerCase();
}

export function assertInteger(value, { label = 'value', minimum = 0, maximum = Number.MAX_SAFE_INTEGER } = {}) {
  if (!Number.isSafeInteger(value) || value < minimum || value > maximum) {
    throw new TypeError(`${label} must be an integer between ${minimum} and ${maximum}`);
  }
  return value;
}

export function assertPlainObject(value, label = 'value') {
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.getPrototypeOf(value) !== Object.prototype) {
    throw new TypeError(`${label} must be a plain object`);
  }
  return value;
}

export function rejectSensitiveKeys(value, path = '$') {
  const forbidden = /(raw(tx|transaction)?|private.?key|seed|mnemonic|secret|credential|password|outpoint|wif)/i;
  if (Array.isArray(value)) {
    value.forEach((entry, index) => rejectSensitiveKeys(entry, `${path}[${index}]`));
    return;
  }
  if (!value || typeof value !== 'object') return;
  for (const [key, child] of Object.entries(value)) {
    if (forbidden.test(key)) throw new TypeError(`Sensitive field is forbidden on the public API: ${path}.${key}`);
    rejectSensitiveKeys(child, `${path}.${key}`);
  }
}
