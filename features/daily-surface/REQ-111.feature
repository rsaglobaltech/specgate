Feature: done is apply under its old name

  @REQ-111 @SCN-111a
  Scenario: Same result under both names
    Given two copies of a project with pending REQ-002, a test that names it and a passing test command
    When the developer runs `specgate done REQ-002 --json` in one and `specgate apply REQ-002 --json` in the other
    Then both exit 0, both leave REQ-002 Implemented, and the two JSON documents are equal apart from the command name
