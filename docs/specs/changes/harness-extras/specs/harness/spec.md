# Delta — harness

## ADDED Requirements

### Requirement: REQ-588 — The agent in a container

The system SHALL, when `harness.config.yaml` sets `sandbox:` (an image, a network of `none` or `default`, an engine of `docker` or `podman`), run the agent, reviewer and adversary sessions in that container as the user running the harness, seeing only the requirement's worktree, its prompt file, the run's events folder and the dependency cache at their own paths, with no network unless `default` is set, and with only the variables `agent_env:` names and the harness's own.

#### Scenario: SCN-588a — An agent with no network and no credentials but its own

- GIVEN `sandbox: { image: ghcr.io/acme/agent:1 }` and `agent_env: [ANTHROPIC_API_KEY]`
- WHEN the harness runs the agent
- THEN the command runs in `ghcr.io/acme/agent:1` with `--network none`, the worktree as its working directory, and `-e ANTHROPIC_API_KEY` among the variables

#### Scenario: SCN-588b — A real container

- GIVEN Docker, an image holding the agent's CLI, `sandbox: { image: <it>, network: none }` and `agent_env: [ANTHROPIC_API_KEY]`
- WHEN the harness runs the agent with `ANTHROPIC_API_KEY` and `AWS_SECRET_ACCESS_KEY` in its environment
- THEN the agent reads its prompt, finds no network, has `ANTHROPIC_API_KEY` and `SPECGATE_REQ` but no `AWS_SECRET_ACCESS_KEY`, and writes in its worktree, at its own path, files owned by the person running the harness

<!-- specgate:trace actor=Developer feature=features/harness/REQ-588.feature kind=functional status=Approved -->

### Requirement: REQ-589 — One download cache for every worktree

The system SHALL, with `dependency_cache: true`, point the download caches of npm, Yarn, pnpm, pip, uv, Go and NuGet at `.harness/cache/` of the project — made if absent and ignored by git — for each worktree's setup command and agent, leaving alone a variable the person already set and never sharing an installed dependency tree.

#### Scenario: SCN-589a — The second worktree reads from disk

- GIVEN `dependency_cache: true`
- WHEN a worktree's setup runs
- THEN `npm_config_cache` names `.harness/cache/npm` of the project, and git shows nothing new

<!-- specgate:trace actor=Developer feature=features/harness/REQ-589.feature kind=functional status=Approved -->

### Requirement: REQ-590 — A run as an OpenTelemetry trace

The system SHALL, when `OTEL_EXPORTER_OTLP_ENDPOINT` or `OTEL_EXPORTER_OTLP_TRACES_ENDPOINT` is set, send each finished run to it as an OTLP/JSON trace — the run, each requirement, each attempt with the stage it failed at, and each agent session, with results, attempts, tokens and cost as attributes — honouring `OTEL_EXPORTER_OTLP_HEADERS` and `OTEL_SERVICE_NAME`, and SHALL only warn when the collector cannot be reached.

#### Scenario: SCN-590a — A run in the team's tracing tool

- GIVEN `OTEL_EXPORTER_OTLP_ENDPOINT=http://collector:4318`
- WHEN a harness run of REQ-000 ends
- THEN the collector receives `/v1/traces` with the spans `harness run` and `REQ-000`

<!-- specgate:trace actor=Developer feature=features/harness/REQ-590.feature kind=functional status=Approved -->

### Requirement: REQ-591 — A pause between attempts

The system SHALL, with `harness run --pause-between-attempts`, wait after a failed attempt and before the next one, saying so and writing where it paused, until `specgate harness continue` lets the next attempt start or `specgate harness continue --stop` (or a stop request) ends the requirement without it; `harness continue` with no paused run SHALL say so with `harness_not_paused`.

#### Scenario: SCN-591a — Stopped at the pause

- GIVEN a run with `--pause-between-attempts` and `--max-attempts 3` whose first attempt fails
- WHEN the person runs `specgate harness continue --stop`
- THEN the requirement ends failed after one attempt

<!-- specgate:trace actor=Developer feature=features/harness/REQ-591.feature kind=functional status=Approved -->
