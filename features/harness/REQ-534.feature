Feature: The agent's own instructions are protected by default

  @REQ-534 @SCN-534a
  Scenario: The agent edits its own instructions
    Given a project with the default protected paths and an agent that writes a source file and appends a line to `CLAUDE.md`
    When a tool runs `specgate harness run --req REQ-000`
    Then the attempt fails with `agent_touched_protected_path` naming `CLAUDE.md`
