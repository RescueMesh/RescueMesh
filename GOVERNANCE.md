# Governance

RescueMesh is an open protocol project. No maintainer can redefine Bitcoin consensus, force transaction inclusion or activate another operator's mainnet deployment.

## Decision classes

- Documentation and tests: one maintainer review.
- Public API or discovery changes: RFC plus one security review.
- Cryptography, payouts, raw handling or mining adapters: RFC plus two independent reviews.
- Mainnet interlocks: unanimous maintainer approval, external review and an explicit versioned release.

Generated proposals and popularity do not override security invariants. A proposal that weakens secret isolation, local control or consensus validation is rejected regardless of economic benefit.
