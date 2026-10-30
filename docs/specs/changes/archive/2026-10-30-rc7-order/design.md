# Design: rc7-order

> Owner: architect — how it is built: modules, mechanisms, channels.

## Modules

- `scripts/lib/story-part.ts` — `contractsNotYetSpecified(projectDir, changeId)`.
- `scripts/cli/commands/change/ChangeCommand.ts` — `cmdAuthor` refuses with `author_contracts_first`.
- `scripts/lib/workspace.ts` — `checkWorkspace`, the REQ-295 loop.

## Mechanisms

- AC-1 — `contractsNotYetSpecified` reads the sub-change's `story.json`, the workspace's roles and the
  story's map of criteria (a story that maps none shares them all, as REQ-386 does), and returns the
  contracts members whose sub-change has no requirement (`changeRequirements`). `cmdAuthor` fails with
  `author_contracts_first` for any artefact but `discover`, naming the first one to write.
- AC-2 — `--force` and `--dry-run` skip the refusal; it is empty once the contracts' delta has a
  requirement.
- AC-3 — the requirements of the member's open changes not yet delivered (`inFlightRequirements`) are
  the waiting ones: their `workspace_dependency_pending` is a warning in `workspace.warnings`, the others
  stay errors.

## Decisions

- A refusal with `--force`, not a warning: the warning `layer_no_contract_cited` was there in run 6 and
  approval went past it.
