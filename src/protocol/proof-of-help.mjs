import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { canonicalBytes } from '../lib/canonical-json.mjs';
import { hash256, objectDigest } from '../lib/crypto.mjs';
import { assertHex, assertSafeId } from '../lib/validation.mjs';
import { publicKeyPem } from '../security/keys.mjs';

const TWO_256 = 1n << 256n;

function uint256FromInternalHash(hash) {
  return BigInt(`0x${Buffer.from(hash).reverse().toString('hex')}`);
}

function targetFromHex(targetHex) {
  return BigInt(`0x${assertHex(targetHex, 32, 'target')}`);
}

function parseHeader(headerHex) {
  const header = Buffer.from(assertHex(headerHex, 80, 'header'), 'hex');
  return {
    header,
    previousBlockHash: Buffer.from(header.subarray(4, 36)).reverse().toString('hex'),
    merkleRoot: Buffer.from(header.subarray(36, 68)).reverse().toString('hex'),
    time: header.readUInt32LE(68),
  };
}

export function verifyWorkShare({ headerHex, job }) {
  if (!job || typeof job !== 'object') throw new Error('Known job is required');
  const parsed = parseHeader(headerHex);
  if (parsed.previousBlockHash !== job.previousBlockHash) throw new Error('Share belongs to a different chain tip');
  if (parsed.merkleRoot !== job.merkleRoot) throw new Error('Share does not commit to the registered job');
  const target = targetFromHex(job.shareTarget);
  const digest = hash256(parsed.header);
  const numericHash = uint256FromInternalHash(digest);
  if (numericHash > target) throw new Error('Share does not meet the registered target');
  return {
    shareId: Buffer.from(digest).reverse().toString('hex'),
    workUnits: (TWO_256 / (target + 1n)).toString(10),
    headerTime: parsed.time,
  };
}

export function createHelpReceipt({ privateKey, publicKey, subject, jobId, share }) {
  assertSafeId(jobId, 'jobId');
  if (typeof subject !== 'string' || subject.length < 3 || subject.length > 128) throw new Error('Invalid Proof-of-Help subject');
  const body = {
    schema: 'rescuemesh/proof-of-help/v1',
    receiptId: share.shareId,
    subject,
    jobId,
    workUnits: share.workUnits,
    issuedAt: new Date().toISOString(),
    issuerPublicKey: publicKeyPem(publicKey),
  };
  const digest = crypto.createHash('sha256').update(canonicalBytes(body)).digest();
  return { ...body, signature: crypto.sign(null, digest, privateKey).toString('base64') };
}

export function verifyHelpReceipt(receipt) {
  if (!receipt || receipt.schema !== 'rescuemesh/proof-of-help/v1') throw new Error('Unsupported Proof-of-Help receipt');
  const { signature, ...body } = receipt;
  const publicKey = crypto.createPublicKey(receipt.issuerPublicKey);
  const digest = crypto.createHash('sha256').update(canonicalBytes(body)).digest();
  if (!crypto.verify(null, digest, publicKey, Buffer.from(signature, 'base64'))) {
    throw new Error('Invalid Proof-of-Help signature');
  }
  return { valid: true, receiptId: receipt.receiptId, workUnits: receipt.workUnits };
}

export class HelpLedger {
  constructor({ filePath, privateKey, publicKey }) {
    this.filePath = path.resolve(filePath);
    this.privateKey = privateKey;
    this.publicKey = publicKey;
    this.jobs = new Map();
    this.seenShares = new Set();
    this.tailDigest = '0'.repeat(64);
    this.initialized = false;
  }

  async initialize() {
    if (this.initialized) return this;
    let text = '';
    try {
      text = await fs.readFile(this.filePath, 'utf8');
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }
    let expectedPrevious = '0'.repeat(64);
    for (const [index, line] of text.split('\n').filter(Boolean).entries()) {
      let entry;
      try { entry = JSON.parse(line); }
      catch { throw new Error(`Proof-of-Help ledger line ${index + 1} is invalid JSON`); }
      if (entry.previousDigest !== expectedPrevious) throw new Error(`Proof-of-Help ledger chain breaks at line ${index + 1}`);
      const unsignedEntry = { previousDigest: entry.previousDigest, receipt: entry.receipt };
      if (entry.digest !== objectDigest(unsignedEntry)) throw new Error(`Proof-of-Help ledger digest fails at line ${index + 1}`);
      verifyHelpReceipt(entry.receipt);
      if (this.seenShares.has(entry.receipt.receiptId)) throw new Error(`Proof-of-Help duplicate at line ${index + 1}`);
      this.seenShares.add(entry.receipt.receiptId);
      expectedPrevious = entry.digest;
    }
    this.tailDigest = expectedPrevious;
    this.initialized = true;
    return this;
  }

  registerJob(job) {
    assertSafeId(job.id, 'job.id');
    const normalized = {
      id: job.id,
      previousBlockHash: assertHex(job.previousBlockHash, 32, 'job.previousBlockHash'),
      merkleRoot: assertHex(job.merkleRoot, 32, 'job.merkleRoot'),
      shareTarget: assertHex(job.shareTarget, 32, 'job.shareTarget'),
      expiresAt: job.expiresAt,
    };
    if (Date.parse(normalized.expiresAt) <= Date.now()) throw new Error('Cannot register an expired job');
    this.jobs.set(normalized.id, normalized);
    return normalized;
  }

  async acceptShare({ jobId, subject, headerHex }) {
    if (!this.initialized) throw new Error('Proof-of-Help ledger must be initialized before accepting shares');
    const job = this.jobs.get(jobId);
    if (!job) throw new Error('Unknown Proof-of-Help job');
    if (Date.parse(job.expiresAt) <= Date.now()) throw new Error('Proof-of-Help job has expired');
    const share = verifyWorkShare({ headerHex, job });
    if (this.seenShares.has(share.shareId)) throw new Error('Duplicate Proof-of-Help share');
    const receipt = createHelpReceipt({ privateKey: this.privateKey, publicKey: this.publicKey, subject, jobId, share });
    const entry = { previousDigest: this.tailDigest, receipt };
    entry.digest = objectDigest(entry);
    await fs.mkdir(path.dirname(this.filePath), { recursive: true, mode: 0o700 });
    await fs.appendFile(this.filePath, `${JSON.stringify(entry)}\n`, { encoding: 'utf8', mode: 0o600 });
    this.seenShares.add(share.shareId);
    this.tailDigest = entry.digest;
    return receipt;
  }
}
