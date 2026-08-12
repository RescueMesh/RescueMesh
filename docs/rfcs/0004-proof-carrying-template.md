# RFC 0004: Proof-carrying sealed template

Status: research.

A coordinator should prove that a hidden transaction set is consensus-valid and pays at least an advertised fee while revealing only commitments required for mining.

The statement must bind to a specific Bitcoin tip, UTXO commitment, block-weight limit, sigop budget, transaction Merkle commitment and coinbase fee value. Proof generation must finish within a useful template lifetime and verification must be cheap enough for miners.

Stratum V2 coinbase-only Job Declaration explicitly identifies zero-knowledge proof extensions as a possible mitigation for invalid hidden templates. RescueMesh would specialize that concept for free rescue bundles and reciprocal accounting.
