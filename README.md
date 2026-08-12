<p align="center">
  <img src="assets/rescuemesh-avatar.png" alt="RescueMesh network shield" width="160">
</p>

# RescueMesh

**Free, non-custodial and privacy-preserving coordination for miners who voluntarily build Bitcoin block templates containing consensus-valid rescue transactions.**

[English](README.md) · [Español](README.es.md)

[Public website](https://rescuemesh.github.io/RescueMesh/en/) · [Installation](docs/INSTALL.md) · [Security](SECURITY.md) · [Architecture](docs/ARCHITECTURE.md) · [Protocol](docs/PROTOCOL.md) · [Economics](docs/ECONOMICS.md)

> **Current status — security-first prototype, regtest only.** RescueMesh does not broadcast to mainnet, connect to Bitcoin Core, construct production blocks, operate a public mining service or promise confirmation. The repository implements and tests the coordination primitives described below; the production mining path is a roadmap, not a deployed service.

## What it can do today

- Simulate whether accepting a transaction would be economically worthwhile for a miner.
- Analyze synthetic regtest transactions and calculate size, weight, txid and wtxid.
- Encrypt transactions locally without publishing them.
- Create verifiable commitments that conceal individual txids.
- Test signed announcements between coordinators.
- Simulate Stratum jobs and verify shares.
- Generate Proof-of-Help receipts.
- Test the architecture, security controls and cooperative economic model.
- Provide a public website that explains the project and helps attract users, reviewers and contributors.

## Contents

- [The problem](#the-problem)
- [What it can do today](#what-it-can-do-today)
- [What RescueMesh is](#what-rescuemesh-is)
- [What RescueMesh is not](#what-rescuemesh-is-not)
- [Why participation can benefit everyone](#why-participation-can-benefit-everyone)
- [Architecture](#architecture)
- [What is implemented today](#what-is-implemented-today)
- [Exact operating model](#exact-operating-model)
- [Economics](#economics)
- [Privacy and data boundaries](#privacy-and-data-boundaries)
- [Security model](#security-model)
- [Local HTTP API](#local-http-api)
- [Command-line interface](#command-line-interface)
- [Installation and first run](#installation-and-first-run)
- [Configuration](#configuration)
- [Automation and governance](#automation-and-governance)
- [Known limitations](#known-limitations)
- [Frequently asked questions](#frequently-asked-questions)
- [Roadmap](#roadmap)
- [Contributing and licensing](#contributing-and-licensing)

## The problem

Some valid Bitcoin transactions are economically or operationally difficult for ordinary relay paths and mining-pool template policies. A transaction owner may need a miner to evaluate a special package, while a miner must protect revenue, validate the candidate and retain control over the block template. Publishing sensitive transaction material too early can also create privacy or transaction-theft risks.

The hard part is not sending bytes to a server. The hard part is aligning four constraints:

1. the owner must retain custody and avoid revealing sensitive material;
2. the miner must never be forced to accept a loss-making or unverifiable template;
3. no coordinator may bypass Bitcoin consensus or manufacture hashrate;
4. cooperation must be auditable without creating a token, a mandatory pool or a central gatekeeper.

RescueMesh is an open protocol experiment around that coordination problem.

## What RescueMesh is

RescueMesh is designed as a mesh of independently operated coordinators and miners. Its primitives let an operator:

- encrypt transaction bytes locally;
- describe a private transaction set through salted public commitments;
- calculate whether inclusion has non-negative expected value for a miner;
- advertise short-lived capabilities without publishing raw transactions or txids;
- exchange signed public announcements between coordinators;
- register aggregate public jobs;
- verify partial proof of work against a specific registered job;
- issue signed, non-transferable Proof-of-Help receipts;
- expose a loopback-only dashboard and API;
- review protocol improvements without allowing automation to deploy them.

Every operator keeps control of their own keys, policy, node, miner connection and eventual template decision. RescueMesh itself takes no custody and defines no alternative consensus rules.

## What RescueMesh is not

RescueMesh is **not**:

- a wallet, custodian or key-recovery company;
- a transaction accelerator or a confirmation guarantee;
- a source of free hashrate;
- a way to mine without satisfying Bitcoin proof of work;
- a way to bypass script validation, standard consensus or miner choice;
- a mining pool or a replacement for Bitcoin Core;
- a public database for raw transactions;
- a token, investment, credit market or promised reward scheme;
- a currently operational mainnet broadcaster;
- a reason to disclose a real private key, seed, outpoint or raw transaction.

If no real miner voluntarily performs enough valid work, no block is found. RescueMesh can improve coordination; it cannot change that physical and consensus constraint.

## Why participation can benefit everyone

RescueMesh does not claim that value appears from nowhere. Cooperation is positive-sum only when measurable value covers the miner's opportunity cost.

| Participant | Potential benefit | Protection built into the design |
| --- | --- | --- |
| Transaction owner | A private route for a difficult package, with no RescueMesh surcharge | Owner keeps custody; raw bytes remain local and encrypted; the free lane reports <code>userAdditionalChargeSats: 0</code> |
| Miner | Existing transaction fees, unused marginal blockspace, verified auxiliary revenue or infrastructure savings | The scheduler rejects candidates below the miner's configured minimum gain; selection remains voluntary |
| Coordinator operator | Shared open-source monitoring, commitments, discovery and accounting instead of rebuilding everything alone | No power over consensus, miner payouts or another operator's deployment |
| Cooperative participants | Verifiable records of useful work that governance may use for reciprocal future priority | Proof-of-Help is signed, job-bound, non-transferable and carries no redemption promise |
| Bitcoin ecosystem | More template-policy diversity and less dependence on a single submission service | Open protocol, local control, no mandatory central directory and no RescueMesh consensus changes |

The phrase “everyone benefits” is therefore conditional:

- the owner pays the fee already committed by their transaction, but RescueMesh adds no rescue commission;
- the miner participates only when expected value meets local policy;
- no party is promised a block, a payout or future priority;
- auxiliary revenue counts only when it is verifiable or already realized;
- a candidate that displaces more valuable transactions is rejected or delayed.

## Architecture

~~~mermaid
flowchart LR
    Owner["Owner-local input"] --> Parser["Bounded local parser"]
    Parser --> Store["AES-256-GCM sealed store"]
    Store --> Bundle["Private bundle + salted public commitments"]
    Bundle --> Scheduler["Marginal-value scheduler"]
    Scheduler --> Job["Aggregate public job"]
    Job --> Discovery["Signed, expiring discovery"]
    Discovery <--> Peers["Federated peer coordinators"]
    Job --> Adapter["Local miner adapter"]
    Adapter --> Shares["Registered proof-of-work shares"]
    Shares --> Receipt["Signed Proof-of-Help ledger"]
    Adapter -. "future production path" .-> Block["Consensus-valid block submission"]
    Block -.-> Node["Operator's Bitcoin node"]
~~~

The trust boundaries are deliberate:

- sensitive transaction material stays on the owner's or trusted coordinator's machine;
- the public layer carries commitments, aggregate economics and capabilities;
- the miner adapter stays local unless a separately reviewed encrypted transport is added;
- the miner's Bitcoin node remains the final validation and submission authority;
- discovery data is untrusted even when correctly signed—a signature identifies a key, not an honest operator.

See [ARCHITECTURE.md](docs/ARCHITECTURE.md) for the component-level model.

## What is implemented today

The following table distinguishes working code from research or planned integration.

| Capability | Status | What the repository actually does |
| --- | --- | --- |
| Local initialization | **Implemented and tested** | Creates a fail-closed regtest configuration, a 256-bit master key, an Ed25519 signing pair and a random API token without replacing existing files |
| Bounded transaction parser | **Implemented and tested** | Parses legacy and witness serialization, canonical CompactSize values, counts, size, weight, vsize, txid and wtxid; it does not perform UTXO, script or full consensus validation |
| Local sealed storage | **Implemented and tested** | Encrypts bytes with AES-256-GCM; authenticates metadata by digest; uses atomic private writes |
| Sealed bundles | **Implemented and tested** | Builds a private manifest and a public envelope containing salted commitments and aggregate economics; opening can later be verified |
| Marginal scheduler | **Implemented and tested** | Uses integer arithmetic to estimate displaced blockspace, opportunity cost and net miner gain; adds zero owner surcharge |
| Signed announcements | **Implemented and tested** | Creates and verifies Ed25519-signed, expiring capability records with SHA-256 anti-spam proof of work |
| Announcement registry | **Implemented and tested** | Rejects expired, stale, forged, oversized-policy or insufficient-work records and purges expired entries |
| Federated gossip | **Partially implemented and tested** | Pushes and pulls public announcements through HTTPS or loopback seeds with timeouts and peer-failure isolation |
| Public job store | **Implemented and tested** | Holds bounded, expiring, aggregate jobs in memory; job creation requires the local API token |
| Proof-of-Help | **Implemented and tested** | Verifies 80-byte headers against a registered tip, Merkle root and target; rejects duplicates; signs receipts and chains ledger entries |
| Threshold secret splitting | **Library primitive implemented and tested** | Splits 16–4096 byte secrets into self-checking K-of-N shares over GF(256); no automatic network release ceremony exists |
| Stratum V1 adapter | **Library primitive implemented and tested** | Loopback-only subscribe, authorize, notify and submit flow with client, line and rate limits; it is tested with synthetic jobs and is not wired into <code>npm start</code> |
| Local dashboard and API | **Implemented and tested** | Serves Spanish and English pages on loopback with strict security headers and a public-data-only API |
| Public GitHub Pages site | **Deployed** | Publishes only a ten-file static allowlist; it shows documentation and runs the economics simulator locally in the browser |
| Bitcoin Core RPC/IPC | **Not implemented** | No node connection, UTXO lookup, block construction or broadcast |
| Production mining templates | **Not implemented** | No production coinbase, witness commitment, payout or live share pipeline |
| Tor gossip transport | **Not implemented** | Announcements may describe an onion endpoint, but gossip still needs a local Tor proxy adapter |
| DATUM / Stratum V2 integration | **Planned** | Candidate adapters only; each requires its own threat analysis and tests |
| Proof-carrying hidden templates | **Research** | Required to let a miner verify hidden validity and fee claims without seeing the private transaction set |
| Mainnet submission | **Deliberately unavailable** | Configuration validation always refuses mainnet because no broadcaster exists |

## Exact operating model

### 1. Local identity and secrets

<code>npm run init</code> creates:

- <code>config.local.json</code> with regtest and loopback defaults;
- <code>runtime/secrets/master.key</code> for sealed data;
- <code>runtime/secrets/signing-private.pem</code> and <code>signing-public.pem</code> for announcements and receipts;
- <code>runtime/secrets/api.token</code> for local write authorization.

Files are created exclusively: initialization refuses to overwrite a key or silently repair half of a signing-key pair. POSIX permissions are applied where available; Windows operators still need appropriate ACL and backup discipline.

### 2. Local transaction intake

The current sensitive-input path is the CLI, not the browser or HTTP API. Transaction hex must be piped over standard input so it does not enter normal command history:

~~~bash
printf '%s' "$RAW_TX" | node src/cli.mjs seal --id example-regtest
~~~

Use only synthetic regtest data in this prototype.

The bounded parser checks serialization shape and resource limits and computes structural metadata. It does **not** prove that signatures are valid, inputs exist, no double spend exists, fees are correct or a block would be accepted.

### 3. Authenticated local sealing

The raw bytes are encrypted with AES-256-GCM using a fresh 96-bit nonce. Associated authenticated data contains a safe local identifier, schema and a digest of metadata. Caller-provided metadata is not stored in clear text. Any ciphertext, tag or authenticated-metadata change causes decryption to fail.

The sealed file lives under <code>runtime/</code>, which is excluded from Git. Encryption does not replace endpoint security: anyone who obtains both the sealed file and master key can decrypt it.

### 4. Private manifest and public commitment

A bundle assigns each transaction one of three roles:

- <code>rescue</code>: the transaction that needs special inclusion;
- <code>sponsor</code>: an optional independent transaction contributing miner value;
- <code>standard</code>: another ordinary transaction included in the private set.

The private manifest contains txids, roles, fees, sizes, expiry and a random salt. The public envelope contains only:

- opaque bundle id;
- transaction and role counts;
- total fee and vsize;
- a salted transaction-commitment tree root;
- a salted private-manifest commitment;
- expiration time.

The commitment tree is intentionally not Bitcoin's txid Merkle tree. With one transaction, a normal one-leaf Merkle root would reveal the txid; the salted RescueMesh commitment does not. A later opening reconstructs the commitments and proves the manifest was not changed.

### 5. Economic admission

The scheduler calculates the bytes that would displace other transactions, values them at the current marginal rate and adds only accepted sources of miner value. It then compares net gain with the miner's own minimum.

An accepted simulation means only “the provided economic inputs satisfy this formula.” It does not validate the transaction, verify external revenue or reserve blockspace.

### 6. Aggregate public job

An authorized local operator can register an expiring <code>rescuemesh/public-job/v1</code>. It contains:

- safe job id;
- 32-byte bundle commitment;
- aggregate vsize and fee;
- minimum miner gain;
- requested capabilities;
- creation and expiration times;
- deterministic digest.

Raw transactions, txids, outpoints, private keys, seeds, credentials and similarly named sensitive fields are recursively rejected by the public API. The in-memory store is bounded and purges expired jobs.

### 7. Discovery and gossip

A coordinator may generate a <code>rescuemesh/announcement/v1</code> with:

- node id derived from its Ed25519 public key;
- public key;
- HTTPS, onion or permitted loopback endpoint;
- supported capability names;
- digest of its public policy;
- issue and expiry times;
- SHA-256 anti-spam proof-of-work parameters;
- Ed25519 signature.

Default lifetime is 30 minutes and accepted lifetime cannot exceed one hour. Default anti-spam difficulty is 16 leading zero bits. Announcements reveal an endpoint and stable node key, so they are public metadata—not anonymity magic.

When explicitly enabled, the gossip loop periodically creates its own announcement, pushes it to configured seeds, pulls their current records and accepts only valid newer entries. Peer failure is isolated. Seeds are capped at 32, requests time out, and a failed refresh does not weaken validation.

### 8. Miner adapter and shares

The loopback-only Stratum V1 compatibility library supports:

- <code>mining.subscribe</code>;
- <code>mining.authorize</code>;
- <code>mining.notify</code>;
- <code>mining.set_difficulty</code>;
- <code>mining.submit</code>;
- bounded clients, message size, message rate and retained jobs.

Each share must refer to a job previously issued to that session. The Proof-of-Help verifier separately parses an 80-byte Bitcoin header and verifies that:

1. its previous-block hash equals the registered chain tip;
2. its Merkle root equals the registered job commitment;
3. its double-SHA-256 hash meets the coordinator-registered target.

This proves work against a registered header commitment. It does not by itself prove that hidden transactions are consensus-valid.

### 9. Proof-of-Help accounting

For an accepted unique share, the coordinator can issue an Ed25519-signed receipt binding:

- receipt/share id;
- participant subject;
- registered job id;
- target-derived work units;
- issue time;
- issuer public key.

Ledger records point to the previous record digest, so deletion, reordering or editing is detectable during verification. Proof-of-Help is non-transferable, not money and not a payout claim. Future governance may use it only as auditable evidence for reciprocal service priority.

### 10. Production block path

This step is **not implemented**. A production design would still need to:

1. validate the private set against a committed UTXO view;
2. prove or independently establish absence of double spends;
3. construct coinbase and witness commitments;
4. enforce block weight and sigop limits;
5. bind miner payout policy;
6. update or expire work on each chain-tip change;
7. submit a fully valid block through the operator's own Bitcoin node;
8. handle rejection, reorgs, stale work and incident shutdown.

Until those items are implemented, tested on regtest and signet/testnet4, and independently reviewed, RescueMesh must not be used with real transaction material.

## Economics

### Conservation rule

RescueMesh creates no new bitcoin and cannot guarantee profit. It looks for cases where existing or independently verified value exceeds the cost of inclusion.

~~~text
displaced_vbytes = max(0, rescue_vsize - free_space)
opportunity_cost = ceil(displaced_vbytes × marginal_rate)
gross_benefit = rescue_fee + auxiliary_revenue + infrastructure_savings
net_gain = gross_benefit - opportunity_cost
accept when net_gain >= miner_minimum
owner RescueMesh surcharge = 0
~~~

All production calculations must use integer satoshi units. The implementation accepts marginal rate in integer milli-satoshis per vbyte to avoid floating-point rounding.

### Worked example

For a 12,318 vB package paying 12,318 sats:

- if the candidate block has 12,318 vB genuinely free, displacement cost is zero and the miner gains the existing 12,318-sat fee;
- if no space is free and the marginal rate is 5 sat/vB, opportunity cost is 61,590 sats and net gain is −49,272 sats;
- the scheduler therefore rejects or waits unless verifiable auxiliary revenue or infrastructure savings close the gap.

“Free for the owner” means RescueMesh adds no commission. It does not erase the transaction's existing miner fee, network opportunity cost, electricity cost or any independent service chosen outside this protocol.

### Acceptable value sources

- fees already committed by the private transaction package;
- truly unused marginal blockspace;
- realized merge-mining or other auxiliary revenue;
- measurable pool-fee or shared-infrastructure savings;
- an optional sponsor transaction whose construction and ownership remain independent.

Estimates, future promises, token prices and unverifiable external payments must be valued at zero by an automatic production policy.

## Privacy and data boundaries

| Data | Local/private layer | Public coordination layer | GitHub Pages |
| --- | --- | --- | --- |
| Raw transaction | Encrypted local store only | Forbidden | Forbidden |
| Txids and outpoints | Private manifest / temporary local parsing | Absent | Absent |
| Master and signing private keys | <code>runtime/secrets/</code> | Never transmitted | Absent |
| API token | Local secret file and authorization header | Never advertised | Absent |
| Aggregate vsize and fee | Available | May appear in a public job or bundle envelope | Synthetic simulator inputs only |
| Salted commitments | Built locally | May be shared | Documentation only |
| Node public key and endpoint | Created locally | Public signed announcement | Not automatically listed |
| Capabilities and policy digest | Created locally | Public signed announcement | Documentation only |
| Proof-of-Help receipt | Local ledger / chosen recipient | Shareable by operator policy | Absent |

Important privacy facts:

- encryption protects stored bytes, not a compromised running machine;
- an announcement endpoint and public key can be linkable;
- aggregate size, fee, timing and capability data may still fingerprint activity;
- the current federation is not an anonymity network;
- Tor transport, peer diversity, cover traffic and eclipse resistance remain future work;
- no secret should ever be pasted into GitHub, an issue, a public chat or the public website.

## Security model

### Enforced invariants

- API listener defaults to <code>127.0.0.1</code> and remote binding fails closed.
- Raw transaction transport over HTTP cannot be enabled.
- Mainnet activation always fails because the broadcaster is absent.
- Unknown configuration keys are rejected.
- Write operations require a long bearer token compared in constant time.
- Request bodies, rates, methods, content types, Host and browser origin are bounded or checked.
- Sensitive field names are rejected recursively.
- Public error responses do not expose internal exception text.
- Web responses set a deny-by-default Content Security Policy and isolation headers.
- The bilingual web interface uses no third-party scripts, fonts, trackers or inline executable code.
- Announcements are signed, short-lived, proof-of-work protected and bounded.
- Sealed data uses authenticated encryption and exclusive/atomic file creation.
- Critical CI actions are pinned to immutable commit hashes.
- CI runs on Linux and Windows; CodeQL and secret scanning run automatically.
- The public Pages artifact is produced from an exact static-file allowlist.
- Automated research can open an issue but cannot modify repository contents or deploy.
- The protected <code>main</code> branch requires CI and CodeQL and forbids force pushes and deletion.

### Risks that remain unresolved

- **Hidden-template validity:** a miner cannot yet verify the complete hidden transaction set. A malicious coordinator could waste hashrate.
- **Transaction theft:** revealing some unusual or future-script transactions may allow a competing spend.
- **Economic manipulation:** a peer can lie about external revenue or cost estimates.
- **Denial of service:** announcement proof of work does not stop targeted resource exhaustion.
- **Sybil and federation policy:** a valid signature does not prove a unique or honest operator.
- **Endpoint privacy:** public discovery metadata may identify infrastructure.
- **Windows permissions:** POSIX modes are best effort; production Windows deployments need reviewed ACLs.
- **Supply chain and implementation error:** tests reduce risk but are not an independent audit.

Read the complete [threat model](docs/THREAT_MODEL.md), [security policy](SECURITY.md) and [mainnet checklist](docs/MAINNET_CHECKLIST.md). Report vulnerabilities through GitHub's private vulnerability reporting feature; never put sensitive evidence in a public issue.

## Local HTTP API

The API is intended for the same machine only. Default base URL: <code>http://127.0.0.1:39393</code>.

| Method and route | Authorization | Purpose |
| --- | --- | --- |
| <code>GET /</code> | None, loopback boundary | Spanish local dashboard |
| <code>GET /en/</code> | None, loopback boundary | English local dashboard |
| <code>GET /health</code> | None | Version, network, safety state, uptime and public counts |
| <code>GET /v1/capabilities</code> | None | Public capabilities and explicit limitations |
| <code>GET /v1/announcements</code> | None | Valid, unexpired public announcements |
| <code>POST /v1/announcements</code> | No bearer token; strict public validation | Accept one signed public announcement |
| <code>GET /v1/jobs</code> | None | Current aggregate public jobs |
| <code>POST /v1/jobs</code> | <code>Authorization: Bearer …</code> | Register an aggregate public job |
| <code>POST /v1/simulate</code> | None | Run the integer marginal-value calculation |

Default limits are 32 KiB per JSON body and 120 requests per minute per observed client address. Only <code>application/json</code> is accepted for JSON bodies. Known routes reject unsupported methods explicitly.

The API deliberately has no endpoint to upload, retrieve or broadcast a raw transaction.

## Command-line interface

| Command | Effect |
| --- | --- |
| <code>npm run init</code> | Create safe local configuration and secrets without overwriting existing material |
| <code>npm run doctor</code> | Verify secret presence, loopback binding, raw-HTTP lock and non-mainnet state |
| <code>npm start</code> | Start the local dashboard and API |
| <code>npm run simulate -- --vsize 12318 --fee 12318 --free-space 12318 --marginal-rate 1</code> | Evaluate a candidate locally |
| <code>node src/cli.mjs seal --id example-regtest</code> | Read transaction hex from standard input and seal it locally |
| <code>node src/cli.mjs announcement</code> | Create a signed public announcement file; it does not broadcast it |
| <code>npm run idea-lab</code> | Generate deterministic, untrusted research proposals |
| <code>npm run build:pages</code> | Build the strict public-site allowlist under <code>runtime/pages</code> |
| <code>npm run check</code> | Run lint, secret scan and all tests |

All CLI commands accept <code>--config &lt;path&gt;</code> when invoked through <code>node src/cli.mjs</code>.

## Installation and first run

Requirements:

- current Windows, macOS or Linux;
- Git;
- Node.js 20.11 or newer, including npm;
- approximately 100 MB of free space for the prototype.

No ASIC, full Bitcoin node or RescueMesh account is required to run the local regtest prototype. Real mining and Bitcoin integration would require additional hardware or external operator infrastructure that this version does not provide.

~~~bash
git clone https://github.com/RescueMesh/RescueMesh.git
cd RescueMesh
npm run check
npm run init
npm run doctor
npm start
~~~

Open:

- Spanish: <http://127.0.0.1:39393>
- English: <http://127.0.0.1:39393/en/>

Stop the service with <code>Ctrl+C</code> in the same terminal.

There are no third-party runtime packages in version 0.1, so <code>npm install</code> is not required. See [INSTALL.md](docs/INSTALL.md) or [INSTALL.es.md](docs/INSTALL.es.md) for the full instructions.

### Public site versus local service

- [GitHub Pages](https://rescuemesh.github.io/RescueMesh/en/) is one shared static website. It explains the project and runs the economics calculator inside the visitor's browser.
- The local service at <code>127.0.0.1</code> is a separate instance on each operator's computer. It owns that operator's local keys, configuration and live status.
- GitHub Pages cannot read a visitor's local RescueMesh files, keys, jobs or API.
- Closing the local terminal does not take down the public documentation website.

## Configuration

The default configuration is intentionally conservative:

| Setting | Default | Meaning |
| --- | --- | --- |
| <code>network</code> | <code>regtest</code> | Safe local Bitcoin test network |
| <code>api.host</code> | <code>127.0.0.1</code> | Local-machine access only |
| <code>api.port</code> | <code>39393</code> | Dashboard and API port |
| <code>api.maxBodyBytes</code> | <code>32768</code> | Maximum JSON request body |
| <code>api.requestsPerMinute</code> | <code>120</code> | Per-client rate limit |
| <code>discovery.enabled</code> | <code>false</code> | No federation by default |
| <code>discovery.automaticAnnounce</code> | <code>false</code> | No automatic announcement by default |
| <code>discovery.minimumPowBits</code> | <code>16</code> | Minimum anti-spam work |
| <code>discovery.maximumTtlSeconds</code> | <code>1800</code> | Default maximum record lifetime |
| <code>economics.minimumNetGainSats</code> | <code>0</code> | Reject negative-value jobs |
| <code>economics.maximumRescueVsize</code> | <code>100000</code> | Local policy bound |
| <code>economics.maximumFreeJobsPerTemplate</code> | <code>1</code> | Conservative free-lane policy |
| <code>security.allowRemoteApi</code> | <code>false</code> | Prevent remote binding |
| <code>security.allowRawTransactionHttp</code> | <code>false</code> | Hard invariant; any other value is rejected |
| <code>mainnet.enabled</code> | <code>false</code> | First mainnet interlock |
| <code>mainnet.submissionEnabled</code> | <code>false</code> | Second mainnet interlock |

Even if both mainnet flags and the explicit environment acknowledgement are supplied, the program stops with “mainnet broadcaster is intentionally not implemented.”

Do not expose the local API by changing the listener, port forwarding, reverse proxying or opening a firewall rule. A future remote control plane needs authentication, encryption and a separate threat review.

## Repository structure

~~~text
src/bitcoin/       bounded transaction parsing
src/coordinator/   aggregate public job storage
src/discovery/     signed registry and HTTPS gossip
src/economics/     marginal-value scheduler
src/http/          loopback API and hardened static server
src/mining/        loopback Stratum V1 compatibility primitive
src/protocol/      bundle commitments, announcements and Proof-of-Help
src/security/      keys, sealed storage and threshold splitting
web/               bilingual local/public interface
scripts/           checks, Pages builder, research and upstream review
test/              security, protocol, web and economics tests
docs/              architecture, threat model, RFCs and operations
research/          public deterministic idea-model inputs
runtime/           generated local state; ignored and never published
~~~

## Automation and governance

### Continuous security

Every pull request and main-branch change runs:

- repository lint and source checks;
- secret-pattern scanning;
- the complete Node test suite on Linux and Windows;
- CodeQL JavaScript analysis;
- a strict Pages build that publishes only approved static assets.

Dependabot proposes GitHub Actions and npm metadata updates weekly. Third-party workflow actions are pinned by full commit digest.

### Research automation

The Idea Lab combines public design primitives and opens at most one review issue twice a month. The upstream watcher reviews public releases of Bitcoin Core, Stratum V2, DATUM and related projects weekly. Their output is untrusted:

- they may propose;
- they may not merge;
- they may not modify repository contents;
- they may not deploy;
- they may not handle secrets;
- they may not activate mainnet.

### Decision policy

- documentation and tests require maintainer review;
- public API and discovery changes require an RFC and security review;
- cryptography, payouts, raw handling and mining adapters require an RFC and two independent reviews;
- mainnet interlocks require unanimous maintainers, external review and an explicit versioned release.

See [GOVERNANCE.md](GOVERNANCE.md), [CONTRIBUTING.md](CONTRIBUTING.md) and [AUTOMATION.md](docs/AUTOMATION.md).

## Known limitations

1. **No real end-to-end rescue:** the implemented primitives are not yet connected into a production Bitcoin template pipeline.
2. **No consensus validation:** the parser understands serialization but does not execute Bitcoin scripts or consult a UTXO set.
3. **No Bitcoin node adapter:** there is no RPC, IPC, ZeroMQ or P2P submission path.
4. **No live miner service:** the Stratum library is loopback-only, synthetic in tests and not started by the CLI.
5. **No hidden-validity proof:** a miner cannot independently trust a concealed package.
6. **No automatic onion distribution:** onion-capable discovery metadata exists, but Tor transport and bootstrapping are unfinished.
7. **No guaranteed positive sum:** the economic result depends entirely on accurate local inputs and real available value.
8. **No confirmation promise:** valid work may never meet the Bitcoin network target.
9. **No production key ceremony:** threshold shares are a tested primitive, not a managed recovery service.
10. **No independent security audit yet:** passing tests and CodeQL are evidence, not proof of absence of vulnerabilities.

## Frequently asked questions

### Does RescueMesh send Bitcoin transactions today?

No. Mainnet broadcast is absent and deliberately blocked. The public website never sends transactions.

### Can RescueMesh confirm a transaction without miners?

No. Bitcoin confirmation still requires a miner to produce a block whose hash meets the network target and whose contents satisfy consensus.

### Does the owner keep the entire transaction output or puzzle prize?

RescueMesh adds zero service commission. The transaction's own miner fee and any independently constructed sponsor transaction still have their normal economic effect. RescueMesh cannot rewrite a signed transaction without the required signing authority.

### Why would a miner participate for free?

“Free” refers to no extra charge to the owner. A rational miner participates only when existing fees, genuinely unused space, realized auxiliary revenue or infrastructure savings make the candidate meet its own minimum expected gain.

### Can a miner see the raw transaction?

Not through the current public API or discovery record. A future production path must either use a trusted miner-local coordinator or provide a reviewed proof-carrying template. The current prototype does not solve that final trust problem.

### Does RescueMesh hide the operator's IP address?

No. Loopback protects the local API from network exposure, but public HTTPS discovery exposes an endpoint. Tor gossip transport is future work; operators must not assume anonymity.

### Is Proof-of-Help a token or payment?

No. It is a signed receipt for a valid share bound to one registered job. It is non-transferable and carries no redemption, investment or payout promise.

### Can I use <code>bootstrap.dat</code> instead of a node?

Not for this prototype's missing production path. A bootstrap file can help populate blockchain data for compatible node software, but it is not a validating node, miner, wallet or transaction broadcaster by itself.

### Does running the local website publish my files?

No. By default it listens only on <code>127.0.0.1</code>. Do not change that boundary or expose it through a tunnel or proxy without a new security review.

### Does the public website depend on the founder's computer?

No. GitHub Pages hosts the shared static documentation. Each operator's functional local instance remains on their own machine.

### Can an automated idea modify production code?

No. Automation may create a review issue only. Protected-branch checks and governance are designed to keep generated ideas out of production until humans review and test them.

### Is it safe to use real transaction material?

No—not in version 0.1. Use synthetic regtest fixtures until the mainnet checklist, external review and production integrations are complete.

## Roadmap

### 0.1 — safe foundation

Implemented: sealed local storage, bundle commitments, integer scheduler, signed discovery, Proof-of-Help primitives, local dashboard, bounded transaction parser, synthetic loopback Stratum V1 adapter, threshold splitting and mainnet fail-closed controls.

### 0.2 — regtest integration

Planned: Bitcoin Core regtest adapter, differential fixtures, coinbase and witness construction, property-based block/share tests and signed public-job persistence.

### 0.3 — cooperative mining adapters

Planned: DATUM, Stratum V2 coinbase-only Job Declaration, blinded reward sharing, realized auxiliary-revenue accounting and Tor gossip.

### 0.4 — proof-carrying sealed jobs

Research: consensus-validity statement, fee-floor proof, benchmarked proof systems and independent cryptographic review.

### 1.0 — candidate production release

Requires every item in [MAINNET_CHECKLIST.md](docs/MAINNET_CHECKLIST.md), multiple independent operators, reproducible signed releases and an external security review. No date or confirmation outcome is promised.

## Contributing and licensing

Contributions are welcome when they preserve the security invariants:

1. discuss material protocol changes in an RFC issue;
2. use only synthetic regtest data;
3. add tests for cryptographic, economic and consensus assumptions;
4. run <code>npm run check</code>;
5. explain security impact in the pull request;
6. never attach real secrets or transactions.

RescueMesh is licensed under **AGPL-3.0-only**. Network operators who modify and expose the service must make the corresponding source available under the same license.

The project is experimental software provided without a promise of fitness, profit, confirmation or mainnet safety.
