Feature: The harness records each requirement's run as events

  @REQ-128 @SCN-128a
  Scenario: One requirement, one attempt
    Given a project whose harness delivers REQ-002 at the first attempt
    When the developer reads `.harness/events/REQ-002.jsonl`
    Then it holds an attempt start, a gate line for each stage with result `pass`, and an attempt end with result `pass`, each with `req` "REQ-002" and `attempt` 1
    And the agent saw `AGENT_EVENTS_FILE` naming that file, and `git status` lists nothing under `.harness/`
