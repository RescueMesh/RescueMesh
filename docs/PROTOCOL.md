# Protocol sketch

All structures use canonical JSON with lexicographically sorted object keys before hashing or signing.

## Public bundle envelope

`rescuemesh/public-bundle/v1` contains:

- opaque bundle id;
- count and aggregate role counts;
- total vsize and total fees;
- root of a salted transaction-commitment tree (not Bitcoin's txid Merkle tree);
- salted private-manifest commitment;
- expiration.

Individual txids and raw transactions are absent.

## Discovery announcement

`rescuemesh/announcement/v1` contains node key, endpoint, capabilities, policy digest, timestamps, proof-of-work parameters and Ed25519 signature. Maximum accepted lifetime is one hour; the default is thirty minutes.

The proof-of-work digest is SHA-256 over canonical unsigned JSON. The signature covers that digest.

## Public mining job

`rescuemesh/public-job/v1` contains only an opaque bundle commitment, aggregate economics, requested capabilities and expiration. Administrative creation requires the local API token.

## Proof-of-Help

`rescuemesh/proof-of-help/v1` binds:

- receipt id derived from the double-SHA-256 header hash;
- participant subject;
- registered job id;
- target-derived work units;
- issue time and issuer public key.

The receipt is signed with Ed25519. Ledger entries additionally commit to the digest of the previous entry.

## Future proof-carrying template

A production sealed lane should prove at least:

1. every sealed transaction is consensus-valid against a committed UTXO view;
2. the set has no internal double spends;
3. aggregate inputs minus outputs equals the advertised fees;
4. the full candidate respects block weight and sigop limits;
5. the public Merkle commitment matches the private set.

The proof must be cheap to verify and generated before miners spend material work on the template.
