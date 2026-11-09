# Delta — live-harness

## ADDED Requirements

### Requirement: REQ-273 — Every gate step is seen when it starts and when it ends

The system SHALL record, for each step of a requirement's gate — the setup command, `validate --strict`, the end-to-end test, the architecture check, the test command and each quality check, with its runner and image — a `gate-start` event when it starts and a `gate` event when it ends, with its result and its duration in milliseconds, written as the step happens and whatever the agent command is; and `harness run` SHALL print a line when each step starts and one when it ends with its result and duration, without `--verbose`.

#### Scenario: SCN-273a — The events follow the gate as it runs

- GIVEN a project whose quality checks are `marker` and `final`, and an agent that writes one file
- WHEN `specgate harness run` runs it
- THEN the events hold, in order, a `gate-start` then a `gate` for `validate --strict`, for `quality: marker` (runner local) and for `quality: final`, each `gate` with its `ms`, and the run's output names each step as it starts and as it ends

<!-- specgate:trace status=Implemented test=tests/unit/live-gate-steps.test.ts actor=Developer kind=functional -->

### Requirement: REQ-274 — The live view names the step that is running

The system SHALL show in `/live`, for a running requirement whose last gate step started and has not ended, that step's name and how long it has run, in its pipeline and in the sidebar's Now; and SHALL show each ended step's duration from its `ms`.

#### Scenario: SCN-274a — A check that has run for three minutes

- GIVEN REQ-007's events: the agent's steps, a `gate` for `validate --strict`, and a `gate-start` for `quality: coverage` three minutes ago
- WHEN the live model is read
- THEN REQ-007 is in its gate with `quality: coverage` running since three minutes ago, and the live page draws the running step by its name

<!-- specgate:trace status=Implemented test=tests/unit/live-gate-steps.test.ts actor=Developer kind=functional -->
