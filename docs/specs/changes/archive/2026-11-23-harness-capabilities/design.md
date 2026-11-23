# Design: harness-capabilities

> Owner: architect — how the system meets the Discover. Name each acceptance
> criterion (AC-1, AC-2…) where it is answered.

## Modules

`scripts/harness/stop.ts`, `scripts/lib/harness-guard.ts`, `scripts/lib/deadline-runner.ts`,
`scripts/lib/run-with-deadline.ts`, `scripts/cli/commands/harness/RunCommand.ts`,
`packages/core/src/domain/{HarnessConfig,HarnessRun,HarnessEvents,RunBudget}.ts`,
`packages/core/src/infrastructure/HarnessConfigFile.ts`.

## Mechanisms

- AC-1 — `harness stop --now` ends the lock holder's process tree (`killTree`);
  each runner sees the run gone (REQ-573) and ends its command; the worktree
  stays, the lock goes with the process. The answer says `stop.now: true`.
- AC-2 — `timeouts: { agent, setup, tests, review }` in seconds; `limitFor`
  picks one per command, else `--timeout`.
- AC-3 — `max_run_cost_usd`: what every session reported (and every worker's,
  from its attempt log) is added up; `budgetVerdict` stops starting
  requirements with `run_max_cost_reached`. `max_tokens`: a requirement's
  input, output and cache tokens. `require_known_cost: true`: a session with no
  reported cost fails its requirement with `cost_unknown`.
- AC-4 — `fallbackAttempt`: on an unavailable agent, the next attempt whose rung
  of `attempt_profiles` names another profile; none, and the run stops as before.
- AC-5 — `agent_env: [NAME, …]`: the runner gives the agent (and reviewer,
  adversary) those variables, `ESSENTIAL_ENV` and the harness's own. Without it,
  the run lists the names of the secret-looking variables, never their values.

## Channels

`harness.config.yaml` keys `timeouts`, `max_run_cost_usd`, `max_tokens`,
`require_known_cost`, `agent_env`; `harness stop --now`; `stop.now`;
`run_max_cost_reached`. Additions only: a minor release.

## Decisions

Limits stay in the file only, as `max_cost_usd` does: a flag typed per run would
be how a limit is bypassed.
