# Architecture

## Design goal

RescueMesh coordinates transaction owners and miners without becoming a custodian, a mandatory pool or a public raw-transaction database.

```text
Owner-local sealed store
          |
          v
Private template coordinator ---- public aggregate job ----> miner adapter
          |                                                   |
          | full block only after valid PoW                   | shares
          v                                                   v
    owner's Bitcoin node                              Proof-of-Help ledger

Signed expiring announcements <---- federated gossip ----> peer coordinators
```

## Components

### Sealed store

Sensitive bytes are encrypted locally with AES-256-GCM. Metadata is authenticated as additional data. The master key is generated separately from the signing key and API token.

### Bundle builder

The private manifest contains transaction identifiers, roles and economics. The public envelope contains only aggregate values, a salted commitment tree root and a second manifest commitment. A one-transaction bundle therefore does not expose its txid. Opening the bundle later proves that it was not changed.

### Marginal scheduler

The scheduler charges only displaced vbytes at the current marginal rate. A candidate is rejected when its fee plus auxiliary revenue and infrastructure savings fail to cover opportunity cost. RescueMesh adds zero owner charge.

### Discovery

Discovery records use Ed25519 signatures, short expiration times and a small SHA-256 proof of work. Records carry only capabilities, endpoint and a digest of public policy. Initial transport is federated HTTPS gossip; onion and Kademlia adapters are future RFCs.

### Proof-of-Help

A coordinator registers a specific job and share target. A receipt is issued only after an 80-byte header commits to the registered previous block and Merkle root and meets the registered target. Receipts are issuer-signed, bound to a subject and stored in a hash chain. They are not currency and are not transferable.

### Local API

The API binds to loopback, applies body and rate limits, sets strict browser security headers and refuses sensitive field names recursively. There is no raw transaction endpoint.

## Trust boundaries

- Miners must be able to verify revenue and template validity without learning sealed inputs. A future proof-carrying template extension is required before this is trust-minimized.
- A coordinator can withhold a valid block but cannot redirect a correctly committed coinbase without invalidating the work.
- Discovery is untrusted input even after signatures; signatures identify a key, not an honest operator.
- Proof-of-Help measures accepted work under an issuer; federation requires cross-issuer policy and Sybil analysis.

## Integration boundary

The prototype deliberately stops before Bitcoin RPC and mainnet submission. Candidate adapters include Stratum V2 Job Declaration coinbase-only mode, DATUM and privacy-preserving reward-sharing systems. Each adapter must have its own threat analysis.
