# Security policy

## Supported versions

RescueMesh is a prototype. No release is approved for mainnet transaction submission.

## Reporting a vulnerability

Do not open a public issue containing raw transactions, outpoints, private keys, Tor identity keys, API tokens, wallet paths or node credentials. Use GitHub's private vulnerability reporting feature once the repository is published.

Until private reporting is configured, reproduce findings with synthetic regtest data and describe only the affected component publicly.

## Non-negotiable invariants

1. No secret or raw transaction is logged.
2. No raw transaction crosses the public API.
3. No mainnet broadcast occurs without explicit, independent interlocks.
4. Discovery records are signed, expire quickly and carry proof of work.
5. Production changes require review; automation may only propose changes.
6. A failed validation closes the path rather than degrading security.
7. Browser traffic is same-origin, loopback-only, and isolated with a deny-by-default Content Security Policy.
8. Public error responses never disclose internal exception messages.

CI runs the test suite and secret scanner on Linux and Windows. CodeQL also runs on every main-branch change, pull request and weekly schedule. Third-party actions are pinned to immutable commit hashes.

See [the threat model](docs/THREAT_MODEL.md) for the full boundary.
