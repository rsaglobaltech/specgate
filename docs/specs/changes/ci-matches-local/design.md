# Design: ci-matches-local

> Owner: architect — how the system meets the Discover.

## Modules

`scripts/cli/commands/project/AdoptCommand.ts`,
`scripts/cli/commands/project/gate.ts`, `scripts/agents/detect.ts`.

## Mechanisms

- AC-1 — `adopt` wrote the CI file before `settle` saved `test_cmd`, so
  `planCi` found no configured command and wrote `check . --test-cmd '<detected>'`.
  After `settle`, when this run wrote the file and `test_cmd` is saved,
  `refreshGate` writes it again: `planCi` now finds the command and writes
  `check .`, which reads it.
- AC-2 — the detected command goes through `withBuild` (`npm test` and a
  `build` script give `npm test && npm run build`, #62) before it is printed,
  saved and stated in `AGENTS.md`. `--var TEST_CMD=…` is not touched.
- AC-3 — `installGate` returns whether it wrote the file; only then is it
  written again.
- AC-4 — `installDetectedAgents` says "Agent commands: not installed — this
  repository has no agent folder" where it said "Agent: none detected".

## Not in this change

Three operating systems by default in the job, and the version pinned in it
beside an installed dependency: both are stated requirements (REQ-455,
REQ-457) and need a decision, not a fix. The files adoption adds.
