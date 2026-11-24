Feature: The compatibility exam for a tool, a level and n runs

  @REQ-711 @SCN-711a
  Scenario: A tool that implements the requirement
    Given a fake codex that writes REQ-002's test and code
    When the Developer runs `specgate compat run --tool codex --level L0 --runs 1`
    Then runs.jsonl has one line for codex at L0 with check passed, hidden check passed and a test naming REQ-002

  @REQ-711 @SCN-711b
  Scenario: A tool that only claims it did
    Given a fake codex that prints "Done, all tests pass" and writes nothing
    When the Developer runs `specgate compat run --tool codex --level L0 --runs 1`
    Then the line has check failed and hidden check failed, whatever the agent printed
