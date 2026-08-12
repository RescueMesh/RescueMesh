# Threat model

## Assets

- raw rescue and sponsor transactions;
- private outpoints and transaction construction details;
- Bitcoin, wallet, Tor and API credentials;
- signing identity and Proof-of-Help integrity;
- miner payout commitments;
- availability of current block templates.

## Adversaries

1. A remote scanner attempting to reach administrative APIs.
2. A malicious discovery peer sending stale, oversized or forged announcements.
3. A miner attempting to claim credit without performing the registered work.
4. A coordinator attempting to advertise nonexistent fees or invalid templates.
5. A contributor accidentally committing secrets or operational files.
6. A supply-chain attacker modifying dependencies or automated workflows.
7. An operator enabling mainnet before completing validation.

## Controls implemented

- loopback-only administrative API;
- authenticated write operations and constant-time token comparison;
- no raw HTTP transport;
- strict request size, rate and field-name validation;
- AES-256-GCM with authenticated metadata;
- separate master, signing and API keys;
- threshold splitting primitive for offline backup and future multi-coordinator release;
- signed expiring advertisements with anti-spam proof of work;
- job-bound share verification and duplicate detection;
- hash-chained, signed Proof-of-Help receipts;
- broad ignore rules and repository secret scanning;
- no runtime dependency packages;
- mainnet fail-closed validation and no broadcaster implementation;
- automated ideas restricted to issues or draft proposals.

## Unresolved risks

### Hidden-template validity

A miner receiving only a blinded header cannot independently validate the hidden transactions. A malicious coordinator could waste hashrate. The preferred mitigation is a proof-carrying template that attests consensus validity and minimum fee revenue without revealing the sealed set. Until implemented, miners must use a trusted local coordinator or accept this risk explicitly.

### Transaction theft

Some future or reserved witness programs may be spendable without a signature under current consensus. Revealing their raw transaction or enough construction material can enable a competing spend. Such transactions must remain in the sealed lane and must never use full-template pool modes that reveal missing transaction data.

### Denial of service

Proof of work slows discovery spam but does not prevent targeted exhaustion. Production federation needs per-peer quotas, bounded storage, backoff and transport-level defenses.

### Economic manipulation

Peers may lie about auxiliary revenue or marginal cost. Only locally verifiable fees and realized payouts should contribute to production scheduling. External revenue estimates require signed oracle policies or conservative zero valuation.

### Windows permissions

POSIX file modes are best-effort on Windows. Production operators must apply Windows ACLs to runtime secret directories and ensure they are not synced to cloud storage.

## Explicitly out of scope

- bypassing Bitcoin consensus;
- mining without real proof of work;
- taking control of wallets or private keys;
- automated mainnet activation;
- anonymous public raw-transaction submission;
- promising confirmation times.
