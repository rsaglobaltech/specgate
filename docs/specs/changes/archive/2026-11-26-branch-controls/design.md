# Design: branch-controls

> Owner: architect — how the system meets the Discover. Name each acceptance
> criterion (AC-1, AC-2…) where it is answered.

## Modules

`scripts/lib/controls.ts` (`branchControls`), `scripts/lib/gate-policy.ts` (the `controls` rule) and `scripts/cli/commands/quality/CheckCommand.ts`. No other source file is added.

## Mechanisms

AC-1 — `branchControls` reads the base's controls from git at the merge base — `.specgate/gate.yaml`, `.specgate/config.json`, the evidence, each open change's `change.yaml` and `approvals.json` — into a folder of its own, and compares them with the working tree through `controlsOf` and `controlsChanged`, the outside judge's own reading. `check` runs it with the base the ids are compared against, and reports each change as `controls_changed_on_branch` in that stage.

AC-2 — "the approval of X is gone" is dropped when the working tree's archive holds a folder ending in `-X`.

AC-3 — a new gate rule `controls`, `warning` in every preset: a branch that approves its own change is ordinary work, and only its reviewer can tell whether the approval was a person's. `controls: error` fails the gate.
