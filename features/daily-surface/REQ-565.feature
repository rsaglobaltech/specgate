Feature: The next step as data

  @REQ-565 @SCN-565a
  Scenario: The next step as data
    Given a project whose next step is `specgate apply REQ-007`
    When a tool runs `specgate status --json`
    Then `next.argv` is `["apply", "REQ-007"]`, `next.placeholder` is false, and `next.command` equals `nextCommand`
