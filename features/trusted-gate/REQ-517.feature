Feature: validate, status and matrix grow linearly with the project

  @REQ-517 @SCN-517a
  Scenario: 500, 1,000 and 2,000 requirements
    Given three generated projects of 500, 1,000 and 2,000 requirements in temporary folders
    When the benchmark runs `validate --strict`, `status --json` and `matrix --json` on each
    Then every run exits 0, and for each command the time on 2,000 is less than six times the time on 500
