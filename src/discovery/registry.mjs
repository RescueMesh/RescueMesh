import { verifyAnnouncement } from '../protocol/announcement.mjs';

export class AnnouncementRegistry {
  constructor({ minimumPowBits = 16, maximumTtlSeconds = 1800, maximumEntries = 1000, allowLocal = false } = {}) {
    this.options = { minimumPowBits, maximumTtlSeconds, allowLocal };
    this.maximumEntries = maximumEntries;
    this.records = new Map();
  }

  purge(now = Date.now()) {
    for (const [nodeId, record] of this.records) {
      if (Date.parse(record.expiresAt) <= now) this.records.delete(nodeId);
    }
  }

  accept(record, now = Date.now()) {
    this.purge(now);
    const verification = verifyAnnouncement(record, { ...this.options, now });
    const previous = this.records.get(record.nodeId);
    if (previous && Date.parse(previous.issuedAt) >= Date.parse(record.issuedAt)) {
      throw new Error('Announcement is not newer than the stored record');
    }
    if (!previous && this.records.size >= this.maximumEntries) throw new Error('Announcement registry is full');
    this.records.set(record.nodeId, structuredClone(record));
    return verification;
  }

  list(now = Date.now()) {
    this.purge(now);
    return [...this.records.values()]
      .sort((left, right) => left.nodeId.localeCompare(right.nodeId))
      .map((record) => structuredClone(record));
  }
}
