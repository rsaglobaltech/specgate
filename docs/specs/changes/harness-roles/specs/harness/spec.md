# Delta — harness

## ADDED Requirements

### Requirement: REQ-532 — A tester and an implementer, as separate sessions

The system SHALL, when `harness.config.yaml` sets `roles: [tester, implementer]`, run each attempt as two agent sessions in the requirement's worktree, in that order: the tester, told to write the failing tests the requirement's scenarios call for and no production code, then the implementer, told to make those tests pass without changing them; each session SHALL get `SPECGATE_ROLE` set to its role in its environment and its role in the run's attempt log; and without `roles:` the harness SHALL keep a single session per attempt.

#### Scenario: SCN-532a — Two sessions, in order

- GIVEN a project whose harness config sets `roles: [tester, implementer]` and an agent that appends `SPECGATE_ROLE` to a log outside the worktree
- WHEN a tool runs `specgate harness run --req REQ-000`
- THEN the log holds `tester` then `implementer`, and the run's attempt log names both roles

<!-- specgate:trace status=Draft actor=Developer kind=functional -->

### Requirement: REQ-533 — Each role stays in its lane

The system SHALL, with `roles:` set, revert after the tester's session every file it created or changed that is not a test file, and after the implementer's session every test file it created or changed — a test file by the conventions the derived matrix uses — keeping build manifests (`package.json`, `pom.xml`, `build.gradle`, `build.gradle.kts`) and the prompt archive; and SHALL report each reverted file as `lane_crossed`, naming the role and the path.

#### Scenario: SCN-533a — The implementer rewrites a test

- GIVEN the project of SCN-532a and an agent that, as tester, writes `tests/a.test.js`, and as implementer writes `src/a.js` and overwrites `tests/a.test.js`
- WHEN a tool runs `specgate harness run --req REQ-000`
- THEN the output reports `lane_crossed` for `implementer` and `tests/a.test.js`, and the tester's content of `tests/a.test.js` is what the gate ran

<!-- specgate:trace status=Draft actor=Developer kind=functional -->

### Requirement: REQ-534 — The agent's own instructions are protected by default

The system SHALL protect by default, besides the specification paths it protects today, the files that steer the agent — `CLAUDE.md`, `.claude/**`, `.cursor/**`, `.github/**` and `.mcp.json` — so that an attempt that changes one fails with `agent_touched_protected_path` naming it, as for any protected path; and `protected_paths` in `harness.config.yaml` SHALL still replace the default list.

#### Scenario: SCN-534a — The agent edits its own instructions

- GIVEN a project with the default protected paths and an agent that writes a source file and appends a line to `CLAUDE.md`
- WHEN a tool runs `specgate harness run --req REQ-000`
- THEN the attempt fails with `agent_touched_protected_path` naming `CLAUDE.md`

<!-- specgate:trace status=Draft actor=Developer kind=functional -->

### Requirement: REQ-535 — A requirement has a cost budget

The system SHALL sum, per requirement, the `cost` each agent session's final usage line reports, and when `max_cost_usd` in `harness.config.yaml` is set and the sum reaches it after a session, SHALL start no further session for that requirement and end it `fail` at the stage `budget`, reporting `budget_exceeded` with the cost and the limit; a session that reports no cost SHALL count as zero, with the warning `cost_unknown` once per requirement while a budget is set.

#### Scenario: SCN-535a — The first attempt spends the budget

- GIVEN `max_cost_usd: 0.5` and an agent that writes a usage line with a cost of 0.6 and a test that fails the gate
- WHEN a tool runs `specgate harness run --req REQ-000`
- THEN the requirement fails after one attempt, and the output reports `budget_exceeded` with 0.60 and 0.5

<!-- specgate:trace status=Draft actor=Developer kind=functional -->
