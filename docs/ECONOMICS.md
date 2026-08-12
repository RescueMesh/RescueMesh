# Cooperative economics

## Conservation rule

RescueMesh cannot make every participant richer by creating value from nothing. A free cooperative can nevertheless improve outcomes by reducing pool fees, using otherwise unfilled marginal blockspace, sharing infrastructure and adding auxiliary revenue to the same work.

## Scheduler equation

```text
displaced_vbytes = max(0, rescue_vsize - free_space)
opportunity_cost = ceil(displaced_vbytes * marginal_rate)
net_gain = rescue_fee + auxiliary_revenue + infrastructure_savings - opportunity_cost
```

A job is accepted only when `net_gain >= configured_minimum`. The owner surcharge is always zero in the free lane.

## Example

A 12,318 vB transaction paying 12,318 sats:

- with 12,318 vB free, opportunity cost is zero and the miner gains the existing fee;
- with no free space and a 5 sat/vB marginal rate, opportunity cost is 61,590 sats and net gain is -49,272 sats;
- the scheduler waits unless verifiable auxiliary revenue closes the gap.

## Proof-of-Help as mutual insurance

Proof-of-Help is a non-transferable receipt for verified shares on registered rescue jobs. Governance may use accumulated work to prioritize a participant's future emergency jobs. It must not be marketed as money, an investment, a guaranteed reward or an asset.

## Sustainable free operation

The protocol charges no rescue commission. Operators may independently fund infrastructure through donations, grants or unrelated hosting, but such funding must not create privileged consensus rules. Any optional paid service belongs in a separate adapter and cannot silently alter the free scheduler.

## Miner dashboard metric

Adapters should expose additional expected sats per unit of work and clearly separate:

- existing transaction fees;
- pool fee savings;
- realized merge-mining income;
- estimated but unverified external value.

Only the first three may justify an automatic production decision.
