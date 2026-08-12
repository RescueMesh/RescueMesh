# RFC 0003: Ephemeral capability gossip

Status: partial implementation.

Coordinators advertise capabilities through signed records with short expiration and anti-spam proof of work. Gossip endpoints exchange these public records without transaction identifiers or identity documents.

The initial implementation supports federated HTTPS pulls and pushes. Tor proxy transport, Kademlia routing, peer scoring, eclipse resistance and diverse bootstrapping remain future work.
