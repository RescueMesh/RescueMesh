# Install RescueMesh

This guide installs an independent local instance. It does not connect a wallet, expose a public port, or enable mainnet.

## Requirements

- an up-to-date Windows, macOS, or Linux system;
- Git;
- Node.js 20.11 or newer, including `npm`;
- at least 100 MB of free space for the prototype source and local files.

An ASIC, a full Bitcoin node, and a RescueMesh account are not required to run the regtest prototype. Mining and integration features outside this release would have additional requirements.

## Install

Open PowerShell, Terminal, or a command shell and run:

```text
git clone https://github.com/RescueMesh/RescueMesh.git
cd RescueMesh
npm run check
npm run init
npm run doctor
npm start
```

Then open `http://127.0.0.1:39393/en`.

Running `npm install` is unnecessary: this release has no external runtime dependencies.

## What each step does

1. `git clone` downloads the public repository only.
2. `npm run check` validates the source, scans for secret patterns, and runs every test.
3. `npm run init` generates keys and a token unique to that machine under `runtime/`.
4. `npm run doctor` confirms regtest, loopback-only API binding, and the absence of mainnet broadcast.
5. `npm start` exposes the interface to that computer only.

## Security boundaries

- Never paste real transactions, private keys, seed phrases, outpoints, or credentials into the public website.
- Never publish or cloud-sync the `runtime/` directory.
- Never replace the `127.0.0.1` binding with `0.0.0.0`.
- Do not use real material before independent review and completion of the testnet/mainnet checklists.
- Stop the instance with `Ctrl+C` in the terminal where it is running.

The public website explains the project and runs its simulator inside the browser. Only the local service displays the real state of each operator's instance.
