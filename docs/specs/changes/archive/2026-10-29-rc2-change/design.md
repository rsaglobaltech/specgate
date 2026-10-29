# Design: rc2-change

> Owner: architect

## Modules

- AC-1 — `InitProjectCommand.adoptsInstead`: `--yes` no longer forces a scaffold; `--new`, `--out`,
  `--config`, `--multi-stack` and `--forja` still do (each describes the project to create).
- AC-2 — `cmdValidate` adds, for a layered change, the blockers `approvalBlockers` finds (the draft
  checklist's errors and open questions) as `change_not_approvable` errors.
- AC-3 — the layered `specs` rules in `scripts/change/instructions.ts`.
- AC-4 — `sharedFeatureFiles` over the change's deltas, an error in `change validate` and in archive.
- AC-5 — `DoneCommand.writeStatus`: once a requirement of an open change is delivered, its tasks are ticked.
- AC-6 — the `change` help text.

## Mechanisms

Each check is the one the later step runs, called earlier; nothing is a second implementation.
