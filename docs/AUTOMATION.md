# Safe automation

## Allowed

- run tests, syntax checks and secret scanning;
- monitor upstream public releases;
- generate economic simulations;
- create an issue or draft RFC describing a possible improvement;
- expire discovery records and reject stale work;
- refresh the local dashboard.

## Forbidden

- merge generated code;
- deploy to mainnet;
- publish raw transactions;
- rotate or reveal secrets;
- post repeatedly to public forums or chats;
- enable remote administrative access;
- change payout addresses or economic thresholds.

The Idea Lab is deliberately deterministic and local. Its output is untrusted. A scheduled GitHub workflow may open a research issue, but it receives issue-only permission and cannot write repository contents.
