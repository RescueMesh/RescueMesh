import { objectDigest } from '../lib/crypto.mjs';
import { assertInteger, assertSafeId, rejectSensitiveKeys } from '../lib/validation.mjs';

export class PublicJobStore {
  constructor({ maximumJobs = 256 } = {}) {
    this.maximumJobs = maximumJobs;
    this.jobs = new Map();
  }

  add(value) {
    rejectSensitiveKeys(value);
    assertSafeId(value.id, 'job.id');
    const expiry = Date.parse(value.expiresAt);
    if (!Number.isFinite(expiry) || expiry <= Date.now()) throw new Error('job.expiresAt must be in the future');
    const normalized = {
      schema: 'rescuemesh/public-job/v1',
      id: value.id,
      bundleCommitment: String(value.bundleCommitment || ''),
      totalVsize: assertInteger(value.totalVsize, { label: 'job.totalVsize', minimum: 1, maximum: 1000000 }),
      totalFeesSats: assertInteger(value.totalFeesSats, { label: 'job.totalFeesSats', minimum: 0 }),
      minimumMinerGainSats: assertInteger(value.minimumMinerGainSats ?? 0, { label: 'job.minimumMinerGainSats', minimum: 0 }),
      capabilities: Array.isArray(value.capabilities) ? [...new Set(value.capabilities.map(String))].sort() : [],
      expiresAt: new Date(expiry).toISOString(),
      createdAt: new Date().toISOString(),
    };
    if (!/^[0-9a-f]{64}$/i.test(normalized.bundleCommitment)) throw new Error('job.bundleCommitment must be a SHA-256 digest');
    normalized.digest = objectDigest(normalized);
    this.purge();
    if (!this.jobs.has(normalized.id) && this.jobs.size >= this.maximumJobs) throw new Error('Public job store is full');
    this.jobs.set(normalized.id, Object.freeze(normalized));
    return normalized;
  }

  purge(now = Date.now()) {
    for (const [id, job] of this.jobs) if (Date.parse(job.expiresAt) <= now) this.jobs.delete(id);
  }

  list(now = Date.now()) {
    this.purge(now);
    return [...this.jobs.values()].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }
}
