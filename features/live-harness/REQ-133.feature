Feature: Explore before a change exists

  @REQ-133 @SCN-133a
  Scenario: An agent that tries to write
    Given a project in git with an open change and an agent command that prints an answer and writes notes.md
    When the developer runs `specgate explore "Should refunds be partial?" --agent` with that command
    Then the agent's answer is shown, notes.md does not exist afterwards, the output names it as undone, and `git status` is as before
