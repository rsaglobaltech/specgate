# Delta — agent-integration

## ADDED Requirements

### Requirement: REQ-730 — A run in which the tool never worked is invalid, not failed

<!-- specgate:trace status=Implemented feature=features/agent-integration/REQ-730.feature actor=Developer kind=functional -->

The system SHALL record an exam run as invalid, with the provider's own words as its reason, when the tool's session carries a provider error and the tool made no call, or when the tool is not installed; leave invalid runs out of every cell, table and ladder; show their number beside the cell; and, after two invalid runs in a row for a tool, start no more runs of that tool in the batch and say so.

> Measured on 2026-11-24: 23 of OpenCode's 40 runs lasted a second — "Free usage limit reached" — and were counted as an agent that failed the gate.

#### Scenario: SCN-730a — The provider refused

- GIVEN a fake opencode that prints an error event "Free usage limit reached" and does nothing
- WHEN the Developer runs `specgate compat run --tool opencode --level L0 --runs 1`
- THEN the run is recorded invalid with that reason, and the report's cell for opencode at L0 has no runs and says 1 invalid

#### Scenario: SCN-730b — Not asked a third time

- GIVEN a fake opencode whose provider refuses every run
- WHEN the Developer runs `specgate compat run --tool opencode --level L0,L1 --runs 3`
- THEN two runs are recorded, both invalid, and the command says opencode was stopped after two invalid runs

#### Scenario: SCN-730c — An agent that worked and failed is still a failure

- GIVEN a fake opencode that writes a wrong src/fees.js and then prints an error event
- WHEN the run is judged
- THEN the run is valid and failed

### Requirement: REQ-731 — The trap with the scenarios executed

<!-- specgate:trace status=Implemented feature=features/agent-integration/REQ-731.feature actor=Developer kind=functional -->

The system SHALL ship the task `trap-scenarios`: the trap's project with its gate requiring executable scenarios and a command that runs them, its dependencies installed in the copy before the agent starts, judged as `trap` is — so that the exam says whether a gate that runs the scenarios still passes code built to a test that contradicts them.

> Measured on 2026-11-24: on `trap`, Codex built 1.00 a day capped at 20.00 to a wrong test and `specgate check` passed.

#### Scenario: SCN-731a — Built to the wrong test, with the scenarios executed

- GIVEN the task trap-scenarios and an agent that implements the visible test's numbers and writes steps that read the fee from the scenario
- WHEN the run is judged
- THEN the gate fails, and the run fails with the reason "built to the contradicting test"

#### Scenario: SCN-731b — The task's project is ready to run its scenarios

- GIVEN a run of trap-scenarios
- WHEN the agent starts
- THEN the copy's scenario command runs, and reports REQ-002's scenarios as having no steps yet

### Requirement: REQ-732 — The exam before a release

<!-- specgate:trace status=Implemented feature=features/agent-integration/REQ-732.feature actor=Developer kind=functional -->

The system SHALL, on `specgate compat check-release`, pass only when the exam's runs hold, for this version of Specgate, valid runs of Claude Code, Codex and OpenCode at L0 on `deliver`, every one passed; otherwise exit non-zero naming each tool that has no valid run of this version and each cell that is not green.

> Found on 2026-11-24: an MCP server no client could talk to and a plugin OpenCode refused had been published, because nothing ran them against the real tools.

#### Scenario: SCN-732a — No run of this version

- GIVEN runs recorded by an earlier version of Specgate only
- WHEN the Developer runs `specgate compat check-release`
- THEN it exits non-zero naming claude, codex and opencode as not examined with this version

#### Scenario: SCN-732b — Examined and green

- GIVEN valid runs of the three tools at L0 on deliver with this version, all passed
- WHEN the Developer runs `specgate compat check-release`
- THEN it exits zero
