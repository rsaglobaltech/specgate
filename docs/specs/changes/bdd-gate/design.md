# Design: bdd-gate

- AC-1 — `scripts/lib/feature-sync.ts`: the change's deltas (`parseDelta`) rendered by `renderDeltaFeature`, a feature-level `@change:<id>` tag added; written by `approveChange` once the three layers are approved, and by `specgate change features <id>`; `ArchiveChangeUseCase` keeps them and the archive drops the tag.
- AC-2 — the gate (`validate`) reads `bdd` from `.specgate/gate.yaml` and `bdd_cmd` from the harness: `bdd_cmd_missing`, `bdd_feature_missing`, `bdd_feature_stale`; `bdd_not_set_up` a warning.
- AC-3 — `apply` runs `bdd_cmd` with `{tags}` = `@<REQ>` before marking it, `apply_bdd_failed` with the tail of its output.
- AC-4 — `bdd.ts`: the command by stack (Playwright → playwright-bdd, Maven → Cucumber); `init`/`adopt` write it; `specgate migrate bdd` writes it and syncs every approved change's features.
