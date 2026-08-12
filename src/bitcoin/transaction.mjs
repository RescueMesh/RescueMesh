import { hash256 } from '../lib/crypto.mjs';

const DEFAULT_LIMITS = Object.freeze({
  maximumBytes: 4_000_000,
  maximumInputs: 100_000,
  maximumOutputs: 100_000,
  maximumScriptBytes: 4_000_000,
  maximumWitnessItemsPerInput: 100_000,
});

function reverseHex(buffer) {
  return Buffer.from(buffer).reverse().toString('hex');
}

class Reader {
  constructor(buffer, limits) {
    this.buffer = buffer;
    this.limits = limits;
    this.offset = 0;
  }

  read(length, label = 'transaction') {
    if (!Number.isSafeInteger(length) || length < 0 || this.offset + length > this.buffer.length) {
      throw new Error(`${label} is truncated at byte ${this.offset}`);
    }
    const result = this.buffer.subarray(this.offset, this.offset + length);
    this.offset += length;
    return result;
  }

  u8(label) { return this.read(1, label)[0]; }
  u32le(label) { return this.read(4, label).readUInt32LE(0); }
  u64le(label) { return this.read(8, label).readBigUInt64LE(0); }

  compactSize(label) {
    const prefix = this.u8(label);
    if (prefix < 0xfd) return prefix;
    if (prefix === 0xfd) {
      const value = this.read(2, label).readUInt16LE(0);
      if (value < 0xfd) throw new Error(`${label} uses non-canonical CompactSize encoding`);
      return value;
    }
    if (prefix === 0xfe) {
      const value = this.u32le(label);
      if (value <= 0xffff) throw new Error(`${label} uses non-canonical CompactSize encoding`);
      return value;
    }
    const value = this.u64le(label);
    if (value <= 0xffffffffn || value > BigInt(Number.MAX_SAFE_INTEGER)) {
      throw new Error(`${label} uses invalid CompactSize encoding`);
    }
    return Number(value);
  }
}

function encodeCompactSize(value) {
  if (!Number.isSafeInteger(value) || value < 0) throw new Error('Invalid CompactSize value');
  if (value < 0xfd) return Buffer.from([value]);
  if (value <= 0xffff) {
    const result = Buffer.alloc(3); result[0] = 0xfd; result.writeUInt16LE(value, 1); return result;
  }
  if (value <= 0xffffffff) {
    const result = Buffer.alloc(5); result[0] = 0xfe; result.writeUInt32LE(value, 1); return result;
  }
  const result = Buffer.alloc(9); result[0] = 0xff; result.writeBigUInt64LE(BigInt(value), 1); return result;
}

export function parseTransactionBytes(value, providedLimits = {}) {
  const limits = { ...DEFAULT_LIMITS, ...providedLimits };
  const raw = Buffer.from(value);
  if (raw.length < 10 || raw.length > limits.maximumBytes) throw new Error('Transaction byte length is outside configured limits');
  const reader = new Reader(raw, limits);
  const versionBytes = reader.read(4, 'version');
  const version = versionBytes.readInt32LE(0);
  let hasWitness = false;
  if (reader.offset + 2 <= raw.length && raw[reader.offset] === 0) {
    const flag = raw[reader.offset + 1];
    if (flag === 0) throw new Error('Transaction has an invalid marker and flag');
    if (flag !== 1) throw new Error('Unsupported transaction witness flag');
    reader.offset += 2;
    hasWitness = true;
  }

  const bodyStart = reader.offset;
  const inputCount = reader.compactSize('input count');
  if (inputCount < 1 || inputCount > limits.maximumInputs) throw new Error('Transaction input count is outside configured limits');
  const inputs = [];
  for (let index = 0; index < inputCount; index += 1) {
    const previousHash = reader.read(32, `input ${index} previous hash`);
    const vout = reader.u32le(`input ${index} vout`);
    const scriptLength = reader.compactSize(`input ${index} script length`);
    if (scriptLength > limits.maximumScriptBytes) throw new Error(`Input ${index} script is too large`);
    reader.read(scriptLength, `input ${index} script`);
    reader.u32le(`input ${index} sequence`);
    inputs.push({ txid: reverseHex(previousHash), vout, witnessItemCount: 0 });
  }

  const outputCount = reader.compactSize('output count');
  if (outputCount < 1 || outputCount > limits.maximumOutputs) throw new Error('Transaction output count is outside configured limits');
  let outputValue = 0n;
  for (let index = 0; index < outputCount; index += 1) {
    const amount = reader.u64le(`output ${index} value`);
    const scriptLength = reader.compactSize(`output ${index} script length`);
    if (scriptLength > limits.maximumScriptBytes) throw new Error(`Output ${index} script is too large`);
    reader.read(scriptLength, `output ${index} script`);
    outputValue += amount;
    if (outputValue > 21_000_000n * 100_000_000n) throw new Error('Transaction output value exceeds Bitcoin supply');
  }
  const bodyEnd = reader.offset;

  let witnessItemTotal = 0;
  if (hasWitness) {
    for (let index = 0; index < inputCount; index += 1) {
      const itemCount = reader.compactSize(`input ${index} witness count`);
      if (itemCount > limits.maximumWitnessItemsPerInput) throw new Error(`Input ${index} has too many witness items`);
      inputs[index].witnessItemCount = itemCount;
      witnessItemTotal += itemCount;
      for (let item = 0; item < itemCount; item += 1) {
        const itemLength = reader.compactSize(`input ${index} witness item ${item} length`);
        if (itemLength > limits.maximumScriptBytes) throw new Error(`Input ${index} witness item ${item} is too large`);
        reader.read(itemLength, `input ${index} witness item ${item}`);
      }
    }
    if (witnessItemTotal === 0) throw new Error('Transaction has a superfluous witness record');
  }

  const locktimeBytes = reader.read(4, 'locktime');
  const locktime = locktimeBytes.readUInt32LE(0);
  if (reader.offset !== raw.length) throw new Error(`Transaction contains ${raw.length - reader.offset} trailing bytes`);

  const stripped = hasWitness
    ? Buffer.concat([versionBytes, raw.subarray(bodyStart, bodyEnd), locktimeBytes])
    : raw;
  const txidDigest = hash256(stripped);
  const wtxidDigest = hash256(raw);
  const weight = stripped.length * 4 + raw.length - stripped.length;
  return Object.freeze({
    version,
    hasWitness,
    inputCount,
    outputCount,
    inputs: Object.freeze(inputs.map(Object.freeze)),
    locktime,
    txid: reverseHex(txidDigest),
    wtxid: reverseHex(wtxidDigest),
    size: raw.length,
    strippedSize: stripped.length,
    weight,
    vsize: Math.ceil(weight / 4),
    outputValueSats: outputValue.toString(10),
  });
}

export function parseTransactionHex(rawHex, limits) {
  const normalized = String(rawHex).replace(/\s+/g, '');
  if (!/^[0-9a-f]+$/i.test(normalized) || normalized.length % 2 !== 0) throw new Error('Transaction must be even-length hexadecimal');
  return parseTransactionBytes(Buffer.from(normalized, 'hex'), limits);
}

export { DEFAULT_LIMITS, encodeCompactSize };
