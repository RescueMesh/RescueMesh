# Roadmap

## 0.1 — Safe foundation

- [x] local encrypted store;
- [x] aggregate bundle commitments;
- [x] integer marginal scheduler;
- [x] signed expiring discovery records;
- [x] Proof-of-Help receipt and ledger primitives;
- [x] local dashboard and security checks;
- [x] bounded local transaction parser that retains no raw or scripts in its summary;
- [x] loopback-only Stratum V1 compatibility adapter;
- [x] threshold secret-splitting primitive for protected backup and future coordinators;
- [x] mainnet fail-closed boundary.

## 0.2 — Regtest integration

- [ ] differential transaction fixtures against Bitcoin Core;
- [ ] Bitcoin Core IPC/RPC adapter restricted to regtest;
- [ ] coinbase and witness commitment construction;
- [x] local Stratum adapter using synthetic jobs;
- [ ] property-based block and share tests;
- [ ] signed public-job persistence.

## 0.3 — Cooperative mining adapters

- [ ] DATUM adapter and payout-policy validation;
- [ ] Stratum V2 coinbase-only Job Declaration experiment;
- [ ] blinded share-reward adapter;
- [ ] realized auxiliary-revenue accounting;
- [ ] Tor transport for signed gossip.

## 0.4 — Proof-carrying sealed jobs

- [ ] specify consensus-validity statement;
- [ ] benchmark STARK/SNARK or alternative fraud-proof approaches;
- [ ] independent cryptographic review;
- [ ] prove fee floor without revealing the private transaction set.

## 1.0 — Candidate production release

Requires every item in `MAINNET_CHECKLIST.md`, multiple independent operators and an external security review. No date is promised.
