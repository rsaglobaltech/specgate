# Delta — live-harness

## ADDED Requirements

### Requirement: REQ-180 — A requirement of the live view opens into everything the project holds about it

The system SHALL serve, for one requirement id, its title, status, module, statement, the spec file and line that define it, its scenarios with their steps, its feature files, the tests that name it, its assumptions, every attempt with its result, duration, the stage it failed at and its gates, and the files its last attempt changed; it SHALL refuse an id that is not a requirement id, and SHALL take the last attempt to be the one that started last.

#### Scenario: SCN-180a — The requirement's text, scenarios and where they live

- GIVEN an open change whose delta defines REQ-024 with a scenario
- WHEN the details of REQ-024 are read
- THEN they hold its statement, its scenario with its steps, and the delta's path and line

#### Scenario: SCN-180b — The tests that name it, and every attempt with its files

- GIVEN a test that names REQ-024 and events for two attempts, the first failed at the tests
- WHEN the details of REQ-024 are read
- THEN they list the test, both attempts with their results and the stage the first failed at, and the files the last changed

#### Scenario: SCN-180c — A later run's attempt 1 is the last attempt

- GIVEN events of a run that failed on attempt 3, then of a later run whose attempt 1 passed
- WHEN the live model is read
- THEN the requirement's last attempt is the later run's attempt 1, passed

<!-- specgate:trace status=Implemented test=tests/unit/live-detail.test.ts actor=Developer kind=functional -->

### Requirement: REQ-181 — The live view groups by module and keeps its header in view

The system SHALL keep the live view's header and run summary in view while it scrolls, SHALL show the run in its centre as a matrix by module (one row per module, one segment per requirement, coloured passed, running, failed, blocked or queued, with requirements the run has not reached yet included), SHALL open the selected requirement into the tabs Steps, Requirement, Tests and files, Attempts and Agent, and SHALL offer a Traceability view of the matrix as it stands, one accordion per module, filtered as the viewer types.

#### Scenario: SCN-181a — A sticky header, modules that fold, and the requirement's tabs

- GIVEN the live page
- WHEN it is served
- THEN its header and summary are sticky, its modules fold, and the requirement has its tabs

#### Scenario: SCN-181b — The traceability matrix as it stands

- GIVEN a capability spec with a delivered requirement and an open change with a draft one
- WHEN the live matrix is read
- THEN both are rows, the first from the spec and the second from the change, each with its module, tests and status

#### Scenario: SCN-181c — The run as a matrix by module

- GIVEN the live page
- WHEN it is served
- THEN its centre is a matrix with a row per module and a segment per requirement, with a legend of passed, running, failed, blocked and queued, and no graph of jobs

<!-- specgate:trace status=Implemented test=tests/unit/live-detail.test.ts actor=Developer kind=functional -->

### Requirement: REQ-182 — The live view shows the run's work queue and the agent's session

The system SHALL record from Claude Code's stream the agent's model, version, permission mode and tool count, the context of each message counted once per message against the model's window, and the session's input, cache and output tokens, cost and turns; SHALL keep the run's queue and each attempt's prompt beside the events, git-ignored; and SHALL show the sidebar as the run's work queue (now, with model, context and output tokens; needs attention; up next, with an estimate; finished recently), the run's tokens and cost in its summary, and the selected attempt's session and prompt in an Agent tab.

#### Scenario: SCN-182a — The adapter records the model, the context and the totals

- GIVEN Claude Code's stream with an init line, a message streamed as two lines, a second message and a result with its usage and cost
- WHEN it is piped through `specgate harness events --from claude`
- THEN the events hold the model and its session, one usage line per message with its context and window, and the totals with cost and turns

#### Scenario: SCN-182b — The live model folds the session and gives the queue and totals

- GIVEN a queue of three requirements and the events of one with a prompt, its model and usage lines between its steps
- WHEN the live model is read
- THEN the requirement carries its model, current and peak context, output, prompt size, steps without the session lines, and the run its queue and, once the session ends, its totals and cost

#### Scenario: SCN-182c — The prompt is kept for the view

- GIVEN an attempt's prompt
- WHEN it is kept
- THEN it is read back from beside the git-ignored events

#### Scenario: SCN-182d — The sidebar is a work queue and the requirement has an Agent tab

- GIVEN the live page
- WHEN it is served
- THEN its sidebar has Now, Needs attention, Up next and Finished recently, and the requirement an Agent tab that reads the prompt

<!-- specgate:trace status=Implemented test=tests/unit/live-agent.test.ts actor=Developer kind=functional -->
