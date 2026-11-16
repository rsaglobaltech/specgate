Feature: The agent does not choose the command that checks it

  @REQ-577 @SCN-577a
  Scenario: A profiles file written by the agent
    Given a requirement's worktree where the agent wrote `.harness/profiles.yaml`
    When a review check's profile is resolved
    Then it is read from the project's folder, not from the worktree
