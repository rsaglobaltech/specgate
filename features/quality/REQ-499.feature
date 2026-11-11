Feature: The coverage report gives the project's line coverage

  @REQ-499 @SCN-499a
  Scenario: An LCOV report, then none
    Given a Node project whose `coverage/lcov.info` has 8 of its 10 executable lines covered
    When a tool runs `specgate report --format json --stdout` and calls `report(dir)`, then removes the report and runs it again
    Then both first answers have `coverage.lines` with `percent` 80, `covered` 8, `total` 10, `tool` `lcov`, `file` `coverage/lcov.info` and `measuredAt`; the last has `coverage.lines` null and `coverage_not_measured` with a fix that names c8
