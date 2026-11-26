Feature: A person's acts are refused to the agent's session

  @REQ-746 @SCN-746a
  Scenario: Switching the guard off
    Given a session of the agent's in a project with the guard on
    When the agent's shell runs `specgate config set agent_guard off`
    Then the call is refused, saying that switching the guard is a person's

  @REQ-746 @SCN-746b
  Scenario: Approving its own change
    Given the same session
    When the agent's shell runs `specgate change approve draft-fees`
    Then the call is refused, saying that approving is a person's

  @REQ-746 @SCN-746c
  Scenario: A review nobody made
    Given the same session
    When the agent's shell runs `specgate apply REQ-002 --steps-reviewed`
    Then the call is refused, saying that reviewing the steps is a person's

  @REQ-746 @SCN-746d
  Scenario: The record removed
    Given the same session
    When the agent's shell runs `rm -rf .specgate/evidence`, or its file tool writes `.specgate/config.json`
    Then the call is refused, naming the file

  @REQ-746 @SCN-746e
  Scenario: Reading is allowed
    Given the same session
    When the agent's shell runs `cat .specgate/evidence/REQ-002/steps.json`
    Then the call is allowed

  @REQ-746 @SCN-746f
  Scenario: No way out in the refusal
    Given source written before its test
    When the guard refuses
    Then the refusal does not name `agent_guard`

  @REQ-746 @SCN-746g
  Scenario: The switch, after the session started
    Given an OpenCode session started with the guard on
    When `.specgate/config.json` comes to say `agent_guard: off`, and the agent writes source before its test
    Then the write is refused
