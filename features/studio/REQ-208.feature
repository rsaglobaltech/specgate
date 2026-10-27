Feature: Build lists what is ready and starts it

  @REQ-208 @SCN-208a
  Scenario: What is ready, and what is not
    Given REQ-210 in an approved change, REQ-211 waiting for an answer, and REQ-213 in a change not approved
    When Build is read
    Then only REQ-210 is ready

  @REQ-208 @SCN-208b
  Scenario: Starting a build
    Given a configured agent and REQ-210 ready
    When Build is started for REQ-210
    Then it answers at once and a harness run for REQ-210 is under way

  @REQ-208 @SCN-208c
  Scenario: No agent, no build
    Given no agent is configured
    When Build is started
    Then it is refused, saying how to configure one
