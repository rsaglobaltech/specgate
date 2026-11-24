# Design: gate-runs-scenarios

> Owner: architect — how the system meets the Discover. Name each acceptance
> criterion (AC-1, AC-2…) where it is answered.

## Modules

- `scripts/lib/bdd.ts` — `runScenarios(projectDir, requirement)`: the one place that runs `bdd_cmd` with `{tags}` as `@<REQ>`; `apply` uses it too (AC-1, AC-2).
- `scripts/harness/run/gate.ts` — a stage `scenarios` after the test command, when the gate policy says `bdd: required`; its output is the hint of the next attempt (AC-1).
- `scripts/cli/commands/quality/CheckCommand.ts` — a stage `scenarios`: each delivered requirement that has a feature file, one after the other; `--no-scenarios` leaves it out for a quick local look and says so (AC-2).
- `scripts/cli/commands/spec/DoneCommand.ts`, `StatusCommand` — the line and the count for requirements delivered on a test alone (AC-3).

## Mechanisms

- A requirement is run by its own tag, as `apply` does: runners differ in how they join tags, and one requirement a run names the one that failed. The cost is one runner start per delivered requirement; `test_cmd_affected` already shows the way to run only what changed, left for when it hurts.
- The harness skips `apply`'s own gate (`--no-check`) because it has just run it; the scenarios were not part of it. They become part of the harness gate, not of that call.
- What this does not close: a step written to assert nothing, or to carry its own number instead of the scenario's. The gate already refuses a scenario with no steps; a step that lies is a review's to catch.

## Decided (2026-11-24)

`specgate init` and `adopt` do not set up a scenario runner in a project that has none: Specgate does not force a dependency on the Developer's project. A project that wants its gate to run its scenarios from the first day is made with forja, which writes the runner and `bdd: required`; any other gets there with `specgate migrate bdd`. Until then AC-3 says, at each delivery, what was not checked.
