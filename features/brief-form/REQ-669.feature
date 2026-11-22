@change:brief-form-why
Feature: Why and Quality in the brief's form

  @REQ-669 @SCN-669a
  Scenario: Read with both sections
    Given a brief with `## Why` and a `## Quality` line "Performance (courses): a page answers in under 2 s"
    When the Developer runs `specgate propose --from-brief --form --json`
    Then `why` holds its text and line, and `quality` holds one entry, its characteristic `performance efficiency`, its modules `courses`, its text and line

  @REQ-669 @SCN-669b
  Scenario: Quality written back, the rest kept
    Given the same brief
    When a form is written back with a second quality line and nothing else changed
    Then only `## Quality` is rewritten, with both lines, and every other byte of the brief is as it was
