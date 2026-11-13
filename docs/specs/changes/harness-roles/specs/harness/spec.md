# Delta — harness

## ADDED Requirements

### Requirement: REQ-532 — Implementer and tester run as separate sessions

The system SHALL, when `harness.config.yaml` sets `roles: [implementer, tester]`, run each attempt as two agent sessions in the requirement's worktree: the tester first, with the requirement, its scenarios and the test conventions, and then the implementer, with the requirement and the tester's failing tests; the tester's prompt SHALL hold no output of the implementer; and without `roles:` the harness SHALL keep today's single session.

#### Scenario: SCN-532a — Two sessions, in order

- GIVEN a project whose harness config sets `roles: [implementer, tester]` and an agent script that logs the role it is given
- WHEN a tool runs `specgate harness run --req REQ-001 --json`
- THEN the log shows `tester` then `implementer`, and the tester's prompt holds the requirement's text and none of the implementer's

<!-- specgate:trace status=Draft actor=Developer kind=functional -->

### Requirement: REQ-533 — Each role stays in its lane

The system SHALL, after the implementer's session, revert every test file it created or changed, and after the tester's session, revert every production file it created or changed — a test file being one the gate counts as a test — keeping build files (`package.json`, `pom.xml`, `build.gradle*`) and reporting each reverted file as the warning `lane_crossed` with the role and the path.

#### Scenario: SCN-533a — The implementer weakens a test

- GIVEN the project of SCN-532a and an implementer that changes `src/cancel.js` and an assertion in `tests/cancel.test.js`
- WHEN a tool runs `specgate harness run --req REQ-001 --json`
- THEN `src/cancel.js` keeps the implementer's change, `tests/cancel.test.js` has the tester's content, and the attempt reports `lane_crossed` for `implementer` and `tests/cancel.test.js`

<!-- specgate:trace status=Draft actor=Developer kind=functional -->

### Requirement: REQ-534 — The files that steer the agent are protected

The system SHALL, before the first session of a requirement, record a hash of `spec.md`, `docs/specs/**`, `features/**`, `AGENTS.md`, `CLAUDE.md`, `.mcp.json`, `.claude/**`, `.github/**` and the paths in `harness.config.yaml`'s `protected:`; and when a session changes any of them, the system SHALL end the requirement `stuck` with `protected_path_changed` naming the file, keep the work only as a diff in the run records, and commit nothing for it.

#### Scenario: SCN-534a — The agent edits its own instructions

- GIVEN an agent that writes the code for REQ-001 and appends a line to `CLAUDE.md`
- WHEN a tool runs `specgate harness run --req REQ-001 --json`
- THEN REQ-001 ends `stuck` with `protected_path_changed` naming `CLAUDE.md`, its status is unchanged, and its branch has no new commit

<!-- specgate:trace status=Draft actor=Developer kind=functional -->

### Requirement: REQ-535 — A requirement has a cost budget

The system SHALL sum, per requirement, the `cost` each agent session reports, and when `max_cost_usd` in `harness.config.yaml` is set and the sum reaches it, SHALL start no further session for that requirement and end it `stuck` with `budget_exceeded`, its cost and the limit; a session that reports no cost SHALL count as zero and add the warning `cost_unknown` once per run.

#### Scenario: SCN-535a — The second attempt would cross the budget

- GIVEN `max_cost_usd: 1` and an agent that fails the gate and reports a cost of 0.60 per session
- WHEN a tool runs `specgate harness run --req REQ-001 --json`
- THEN two sessions run, the requirement ends `stuck` with `budget_exceeded`, cost 1.20 and limit 1

<!-- specgate:trace status=Draft actor=Developer kind=functional -->

### Requirement: REQ-536 — Every requirement ends with one outcome, and the run has a first-pass rate

The system SHALL end each requirement a run selects with exactly one outcome — `ready` (the gate passed), `blocked` (a question blocks it), `stuck` (attempts, budget or time spent, or a protected path changed), `pending` (not started because the run stopped) or `skipped` (its status is not one the harness builds, with that status) — in `harness run --json` and in the run's events; and `specgate harness report --json` SHALL give per run the count of each outcome and the `first_pass_rate`: the share of `ready` requirements that passed on their first attempt.

#### Scenario: SCN-536a — Three requirements, three outcomes

- GIVEN REQ-001 whose agent passes on the first attempt, REQ-002 whose agent passes on the second, and REQ-003 still `Draft`
- WHEN a tool runs `specgate harness run --json` then `specgate harness report --json`
- THEN the run answers REQ-001 and REQ-002 `ready` and REQ-003 `skipped` naming `Draft`, and the report gives `ready` 2, `skipped` 1 and `first_pass_rate` 0.5

<!-- specgate:trace status=Draft actor=Developer kind=functional -->

### Requirement: REQ-537 — An agent that finds a gap stops and asks

The system SHALL, after each session, read the change's `questions.md` itself; when the session added an open question marked blocking that names the requirement, the system SHALL drop the session's code and test changes, keep only the question, set the requirement `Needs Clarification`, and end it `blocked`; and a `questions.md` the parser rejects SHALL also end the requirement `blocked`, with `questions_malformed`.

#### Scenario: SCN-537a — The spec does not say what happens at midnight

- GIVEN an agent that, for REQ-001, writes code and adds a blocking question naming REQ-001 to the change's `questions.md`
- WHEN a tool runs `specgate harness run --req REQ-001 --json`
- THEN REQ-001 ends `blocked` with status `Needs Clarification`, the question is in `questions.md`, and the worktree has none of the agent's code

<!-- specgate:trace status=Draft actor=Developer kind=functional -->
