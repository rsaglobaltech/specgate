# Delta — harness

## ADDED Requirements

### Requirement: REQ-583 — A run ended at once, and resumable

The system SHALL, on `specgate harness stop --now`, end the harness run working in the project together with every command it started, keep the requirement's worktree for `--resume`, and answer with `stop.now: true` and the run it ended; with no run working, it SHALL end nothing and say so.

#### Scenario: SCN-583a — Stop now while the agent works

- GIVEN a harness run whose agent ignores SIGTERM
- WHEN the person runs `specgate harness stop --now`
- THEN the agent is no longer running, the answer says `now: true`, and the worktree is kept

<!-- specgate:trace status=Implemented feature=features/harness/REQ-583.feature actor=Developer kind=functional -->

### Requirement: REQ-584 — A time limit per kind of command

The system SHALL read `timeouts:` in `harness.config.yaml` — `agent`, `setup`, `tests`, `review`, each in seconds — and run each kind of command under its own limit, under `--timeout` where none is set, refusing any other key.

#### Scenario: SCN-584a — An agent's hour and the tests' five minutes

- GIVEN `timeouts: { agent: 1800, tests: 300 }`
- WHEN the harness runs the agent, the tests and the setup
- THEN the agent may take 1800 s, the tests 300 s, and the setup the run's `--timeout`

<!-- specgate:trace status=Implemented feature=features/harness/REQ-584.feature actor=Developer kind=functional -->

### Requirement: REQ-585 — The run's budget, a token ceiling, and no free sessions

The system SHALL stop starting requirements once the cost the run's sessions reported, its workers' included, reaches `max_run_cost_usd`, with `run_max_cost_reached`; SHALL stop a requirement's sessions once their tokens reach `max_tokens`; and SHALL, with `require_known_cost: true`, fail a requirement whose session reported no cost, with `cost_unknown`, instead of counting it as free.

#### Scenario: SCN-585a — The run's ceiling reached

- GIVEN `max_run_cost_usd: 5` and the run's sessions reporting $5.20
- WHEN the run is about to start another requirement
- THEN it starts none, naming `max_run_cost_usd` and what was reported

#### Scenario: SCN-585b — A session that reports no cost

- GIVEN `require_known_cost: true` and an agent that reports no usage
- WHEN the harness runs a requirement
- THEN the requirement fails with `cost_unknown`

<!-- specgate:trace status=Implemented feature=features/harness/REQ-585.feature actor=Developer kind=functional -->

### Requirement: REQ-586 — An agent that cannot run now gives way

The system SHALL, when an agent session fails because the agent cannot run now (out of quota, rate-limited), go on with the first later attempt whose `attempt_profiles` rung names another profile, and stop retrying only when no such attempt remains.

#### Scenario: SCN-586a — Out of quota, with another agent configured

- GIVEN `attempt_profiles: [claude, codex]` and claude out of quota on attempt 1
- WHEN the harness meets the failure
- THEN attempt 2 runs with codex instead of the run stopping

<!-- specgate:trace status=Implemented feature=features/harness/REQ-586.feature actor=Developer kind=functional -->

### Requirement: REQ-587 — The project chooses the agent's environment

The system SHALL, with `agent_env: [NAME, …]`, give the agent, the reviewer and the adversary only the variables listed, those every process needs (search path, home and temp folders, locale, Windows' own) and the harness's own; and SHALL, without it, say which variables that look like secrets the agent inherits, by name only.

#### Scenario: SCN-587a — A cloud key the agent does not need

- GIVEN `agent_env: [ANTHROPIC_API_KEY]` and a shell holding `ANTHROPIC_API_KEY` and `AWS_SECRET_ACCESS_KEY`
- WHEN the harness runs the agent
- THEN the agent has `ANTHROPIC_API_KEY`, `PATH` and `SPECGATE_REQ`, and no `AWS_SECRET_ACCESS_KEY`

<!-- specgate:trace status=Implemented feature=features/harness/REQ-587.feature actor=Developer kind=functional -->
