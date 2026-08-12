# Threshold key recovery

RescueMesh includes a tested Shamir-style GF(256) primitive for splitting a secret into `N` shares with a `K`-of-`N` recovery threshold.

This is currently a library primitive, not an automatic network ceremony. Intended uses are:

- offline master-key backup distributed across physically separate locations;
- future per-bundle release across independent coordinators;
- recovery exercises using synthetic keys.

Rules:

1. Never commit a `.share` file. Git and the secret scanner reject that extension.
2. Do not store all shares beside the encrypted data.
3. Do not transmit shares through the discovery network.
4. Test recovery with a generated key before relying on it.
5. A threshold reduces single-party compromise but does not protect against `K` colluding or compromised holders.

Network release after a valid proof of work remains an RFC. The current primitive does not decide when a share should be released.
