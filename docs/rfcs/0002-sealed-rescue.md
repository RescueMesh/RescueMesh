# RFC 0002: Sealed rescue lane

Status: prototype.

The owner stores raw transaction bytes locally under authenticated encryption. Public jobs reveal aggregate economics and salted commitments only. Miners receive a header-compatible work package; the full block is released only after valid network proof of work.

The unresolved problem is proving hidden validity to miners. Mainnet use is prohibited until the coordinator is strictly local to the miner or a reviewed proof-carrying-template design is implemented.
