<p align="center">
  <img src="assets/rescuemesh-avatar.png" alt="RescueMesh network shield" width="160">
</p>

# RescueMesh

RescueMesh is an experimental, free and non-custodial coordination protocol for miners who voluntarily build privacy-preserving Bitcoin block templates containing consensus-valid rescue transactions.

It is **not** a transaction accelerator, wallet, mining pool, or promise of confirmation. It cannot create hashrate and it never bypasses Bitcoin consensus. Its purpose is to automate coordination while keeping transaction selection with participating miners.

> Status: security-first prototype. Regtest only. Mainnet submission is not implemented and is locked by multiple independent safeguards.

[Public website](https://rescuemesh.github.io/RescueMesh/en/) · [Instalación en español](docs/INSTALL.es.md) · [Installation](docs/INSTALL.md) · [Architecture](docs/ARCHITECTURE.md) · [Threat model](docs/THREAT_MODEL.md) · [Protocol](docs/PROTOCOL.md)

## Why miners may benefit

RescueMesh does not invent rewards. It attempts to create a positive-sum cooperative by combining:

- marginal blockspace scheduling that rejects jobs which would reduce expected revenue;
- non-custodial reward-sharing adapters such as DATUM/GridPool-style systems;
- optional auxiliary merge-mining revenue;
- Proof-of-Help receipts that provide reciprocal priority for future rescue needs;
- shared monitoring and template infrastructure without a RescueMesh service fee.

## Security invariants

- Raw transactions are never accepted over HTTP.
- Sealed transactions are encrypted locally with AES-256-GCM.
- Discovery advertisements never contain raw transactions, txids, outpoints, addresses, secrets, or credentials.
- The API is restricted to loopback, rejects untrusted Host and cross-site browser requests, and exposes no CORS permissions.
- The bilingual web interface loads no third-party scripts, fonts, trackers, or executable inline code.
- Mainnet requires separate configuration, environment acknowledgement and implementation approval; this prototype contains no broadcaster.
- Automated research may create proposals, never merge or deploy production code.

## Quick start

Use Node.js 20.11 or newer:

```bash
npm run check
npm run init
npm run doctor
npm start
```

Open `http://127.0.0.1:39393` for the Spanish interface or `http://127.0.0.1:39393/en` for English. Both versions deliberately have no field for raw transactions and persist no browser data.

To seal sensitive material, send it over standard input so it does not enter shell history:

```bash
printf '%s' "$RAW_TX" | node src/cli.mjs seal --id example-regtest
```

Do not use real transaction material until the threat model and mainnet checklist have been independently reviewed.

See the complete [installation guide](docs/INSTALL.md) or the [Spanish installation guide](docs/INSTALL.es.md). The public GitHub Pages deployment contains only the allowlisted static files under `web/`; local configuration, runtime secrets, source modules, and operational files are excluded from its artifact.

## Repository boundaries

This repository contains source code and synthetic fixtures only. Node data, `bootstrap.dat`, wallets, Tor identities, private keys, real transaction hex and project backups must remain outside Git.

## License

AGPL-3.0-only. Network operators who modify and expose RescueMesh must make their corresponding source available under the same license.
