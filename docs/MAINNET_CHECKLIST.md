# Mainnet activation checklist

This checklist is intentionally incomplete until the corresponding RFCs and implementations are reviewed. Every item must be evidenced, not merely checked.

- [ ] Independent review of Bitcoin transaction and block serialization.
- [ ] Independent review of witness commitment construction.
- [ ] Consensus validation against at least two implementations.
- [ ] Regtest property tests and mutation fuzzing.
- [ ] Testnet4 or signet end-to-end block found and accepted.
- [ ] Hidden-template validity proof or explicitly trusted local-only coordinator.
- [ ] Miner payout commitment review.
- [ ] Reorg, stale-template and block-propagation handling.
- [ ] Secure Tor transport and authenticated private control plane.
- [ ] Windows ACL or hardened Linux service account.
- [ ] Reproducible signed release artifacts.
- [ ] Two-person review of every mainnet interlock change.
- [ ] Incident response and emergency shutdown tested.
- [ ] No real raw transaction, secret, node state or identity in Git history.

Even after completion, activation must be an explicit operator action. It must never be triggered by discovery, a web request, CI, an AI proposal or a remote peer.
