# RFC 0001: Proof-of-Help

Status: experimental.

Proof-of-Help is a signed receipt for a valid partial proof of work bound to a registered rescue job. Its only protocol purpose is reciprocal service priority and auditable contribution accounting.

It is non-transferable, carries no redemption promise and must not be sold. Work is calculated from the coordinator-registered target, never from a target supplied by the claimant. Duplicate header hashes are rejected.

Open questions include cross-issuer trust, expiration, privacy-preserving subjects and resistance to coordinators issuing receipts for fabricated jobs.
