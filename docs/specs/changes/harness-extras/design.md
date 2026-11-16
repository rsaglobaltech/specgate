# Design: harness-extras

> Owner: architect — how the system meets the Discover. Name each acceptance
> criterion (AC-1, AC-2…) where it is answered.

## Modules

`packages/core/src/domain/{Sandbox,DependencyCache,RunTrace}.ts` (pure),
`scripts/lib/otel-export.ts`, `scripts/lib/harness-guard.ts` (pause),
`scripts/harness/continue.ts`, `scripts/harness/run/gate.ts` (`agentLine`),
`scripts/cli/commands/harness/RunCommand.ts`.

## Mechanisms

- AC-1 — `sandbox: { image, network: none|default, engine: docker|podman }`:
  `agentLine` wraps the agent, reviewer and adversary command in
  `<engine> run --rm -i --network none --user uid:gid -v … -w <worktree> -e NAME …
  <image> sh -c '<command>'`, mounting the worktree, the prompt file, the
  events folder and the cache at their host paths.
- AC-2 — `dependency_cache: true`: `npm_config_cache`, `YARN_CACHE_FOLDER`,
  `npm_config_store_dir`, `PIP_CACHE_DIR`, `UV_CACHE_DIR`, `GOMODCACHE`,
  `GOCACHE`, `NUGET_PACKAGES` point at `.harness/cache/` (git-ignored) for the
  setup and the agent, unless already set. Download caches only, never an
  installed tree.
- AC-3 — With `OTEL_EXPORTER_OTLP_ENDPOINT` (or `…_TRACES_ENDPOINT`), the run's
  record becomes OTLP/JSON spans — run, requirement, attempt, agent — sent with
  `fetch` once the run ends; `OTEL_EXPORTER_OTLP_HEADERS` and
  `OTEL_SERVICE_NAME` are read. A collector that is down is a warning.
- AC-4 — `--pause-between-attempts`: before each retry the run writes
  `.harness/events/paused.json` and waits; `specgate harness continue` lets it
  go on, `--stop` (or `harness stop --after-current`) ends the requirement.

## Channels

Config keys `sandbox`, `dependency_cache`; flag `--pause-between-attempts`;
command `harness continue`; warning `harness_not_paused`; the OTLP endpoint.

## Decisions

The trace is built from the run record after the run, not live: no dependency,
and the record is already the run's account.
