Feature: The agent reads the principles

  @REQ-692 @SCN-692a
  Scenario: P1 in the prompt
    Given principles.md with `## P1 — Code names its requirement`
    When the Developer runs `specgate harness run --req REQ-004 --dry-run`
    Then the prompt has a "Principles" section naming P1 and its statement
