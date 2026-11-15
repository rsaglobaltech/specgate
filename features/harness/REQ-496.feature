Feature: The run streams one JSON event per line

  @REQ-496 @SCN-496a
  Scenario: A run of one requirement, line by line
    Given a fake agent that prints "working on it" and writes a usage event
    When `specgate harness run --format jsonl` delivers REQ-000
    Then every stdout line parses as JSON; the first is `run-start` and the last `run-end`, whose `report` has the shape `--format json` prints and the result of the `result` event; between them come `attempt`, `agent-start`, an `output` with "working on it" before `agent-end`, the `usage` event, `gate` events and a `result` for REQ-000
