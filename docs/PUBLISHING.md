# Publishing safely

Before creating a GitHub repository:

1. Run `npm run check`.
2. Run `git status --short --ignored` and confirm `runtime/` and `config.local.json` are ignored.
3. Search for known private identifiers and inspect the complete staged diff.
4. Configure a deliberate Git author identity; do not reuse contact details without consent.
5. Install and authenticate GitHub CLI with `gh auth login`.
6. Create a public repository named `rescuemesh` without importing parent-directory history.
7. Push only this nested repository.
8. Enable private vulnerability reporting, branch protection and required CI.
9. Keep mainnet and automatic discovery disabled in the published example configuration.

Never run `git add` from the parent puzzle directory. It contains node state, backups and real transaction material that do not belong in public history.
