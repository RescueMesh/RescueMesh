function normalize(value) {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return value;
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new TypeError('Canonical JSON does not allow non-finite numbers');
    return value;
  }
  if (typeof value === 'bigint') return value.toString(10);
  if (Array.isArray(value)) return value.map(normalize);
  if (Buffer.isBuffer(value) || value instanceof Uint8Array) {
    return { $bytes: Buffer.from(value).toString('base64') };
  }
  if (typeof value === 'object') {
    const result = {};
    for (const key of Object.keys(value).sort()) {
      if (value[key] !== undefined) result[key] = normalize(value[key]);
    }
    return result;
  }
  throw new TypeError(`Canonical JSON cannot encode ${typeof value}`);
}

export function canonicalJson(value) {
  return JSON.stringify(normalize(value));
}

export function canonicalBytes(value) {
  return Buffer.from(canonicalJson(value), 'utf8');
}
