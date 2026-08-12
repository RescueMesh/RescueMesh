# Contributing

Security and correctness take precedence over feature velocity.

1. Discuss material protocol changes in an RFC issue first.
2. Never attach real transaction data or operational secrets.
3. Add tests for every consensus, cryptographic or economic invariant.
4. Run `npm run check` before opening a pull request.
5. Mainnet code, remote listeners, secret handling and automated announcements require two independent reviews.
6. Generated ideas are untrusted design input, not implementation instructions.

Commits should be small, explain the security impact and link to the relevant RFC.
