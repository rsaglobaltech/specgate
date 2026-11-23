# Design: feature-map

> Owner: architect — how the system meets the Discover. Name each acceptance
> criterion (AC-1, AC-2…) where it is answered.

## Modules

- `scripts/lib/feature-map.ts` (new) — the map.
- `scripts/cli/commands/spec/MapCommand.ts` (new) — `specgate map`.
- `scripts/cli/commands/spec/MatrixCommand.ts` — `matrixScenarios` takes the in-flight view it is given.
- `scripts/harness/prompt.ts`, `packages/core/src/domain/AgentPrompt.ts` — the "Where it lives" section.
- `scripts/cli/commands/spec/DoneCommand.ts`, `scripts/lib/evidence.ts` (new) — the evidence.
- `scripts/lib/config-keys.ts`, `HarnessConfigFile.ts` — `app_url`.

## Mechanisms

- AC-1 — `featureMap(projectDir)`: one in-flight view (the project with every
  open change archived into it); its matrix rows (`matrixScenarios`) grouped
  by requirement for feature, scenarios, code and tests; the requirement's
  trace (`spec.md` and the capability specs of the view) for title, `uc`,
  `actor`, `route`; `requirementSurfaces` for surfaces; `e2eTestsNaming`
  under `e2e_dir` for end-to-end tests; `url` = `app_url` (harness config,
  new key) + the route. `specgate map [<REQ>] [--capability <c>] [--json]`.
- AC-2 — route: `route=` in the trace (`routeFrom: "trace"`); else the first
  `goto("…")` / `visit("…")` / `get("…")` path in an end-to-end test, or a
  test, that names the requirement (`routeFrom: "e2e"`); else null.
- AC-3 — `buildPrompt` reads the requirement's map entry: when it has a route
  or end-to-end tests, the prompt gains "Where it lives in the app": the
  route, the address, those tests, and — with `app_url` set — "open it with
  your browser tool (e.g. the Playwright MCP) before you change anything, and
  again after, and check what the scenarios say".
- AC-4 — `apply`, after the gate passes and the status is written:
  `.specgate/evidence/<REQ>/evidence.json` (requirement, date, the commands run
  — the bdd command with its exit code and duration —, the scenarios' tags);
  `bdd.log` (its output, last 400 lines); `artifacts/` — the files Playwright
  left in `test-results/` (screenshots, traces, videos) changed during the run.
  `.specgate/evidence/.gitignore` keeps `artifacts/` out of git.

## Channels

None: files and the CLI. Agents read `specgate map --json`.

## Decisions

Evidence under `.specgate/evidence/`, beside the trust ledger, not a new
top-level folder; the record committed, the binaries ignored.
