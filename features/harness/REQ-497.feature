Feature: A parallel run streams every requirement's events whole

  @REQ-497 @SCN-497a
  Scenario: Two requirements at once
    Given REQ-001 and REQ-002, independent, and a fake agent that prints a line longer than a pipe writes at once
    When `specgate harness run --format jsonl --concurrency 2` delivers both
    Then every stdout line parses as JSON, there are `output` and `result` events for both requirements, and exactly one `run-end`, the last line
