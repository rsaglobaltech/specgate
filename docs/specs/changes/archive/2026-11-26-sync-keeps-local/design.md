# Design: sync-keeps-local

> Owner: architect — how the system meets the Discover. Name each acceptance
> criterion (AC-1, AC-2…) where it is answered.

## Modules

`scripts/cli/commands/specops/SyncCommand.ts` (`syncPack`), and its tests. No other source file changes.

## Mechanisms

AC-1 — for the files sync seeds the render with (`spec.md` of a derived project, the shared catalogs), the merge base was the project's own copy. But `expand` rewrites that copy as it merges the pack in — a requirement's trace comment as the pack writes it, a requirement the pack does not know left out — so base and local were equal and every such rewrite won. The base becomes what the pack's previous version renders over the same seeded copy: `syncPack` renders the recorded version into a second throwaway folder, seeded the same way, and passes each seeded file's render as the base. What `expand` normalises is then in base and incoming alike and cancels; what the new version changes is applied; local edits stay; both changing one line is a conflict. When the version is not changing, the previous render is the incoming one and the project's copy stands.

## Decisions

One more expansion per pack and sync. Cheaper than a per-requirement merge of `spec.md`, and exact: the base is what the team last received.
