Feature: An empty attempt after a written one is retried once

  @REQ-417 @SCN-417a
  Scenario: The agent writes nothing for one requirement of the run
    Given a project with REQ-000, REQ-001 and REQ-002, and an agent that writes the first time for each, except the first time for REQ-001
    When the developer runs `specgate harness run --max-attempts 2`
    Then REQ-001 says the agent produced no files and is retried once, and all three pass
