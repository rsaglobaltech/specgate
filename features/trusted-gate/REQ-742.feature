@change:shortcut-proof
Feature: Source written by any means before its test stops the session

  @REQ-742 @SCN-742a
  Scenario: Written through the shell
    Given draft-fees open with REQ-002 and no test changed, and src/fees.js written by a shell command
    When the agent calls its shell again
    Then the call is refused, naming src/fees.js and REQ-002

  @REQ-742 @SCN-742b
  Scenario: The test puts it right
    Given the same session, refused
    When the agent writes test/fees.test.js naming REQ-002, then calls its shell
    Then the write is allowed, and the shell call after it

  @REQ-742 @SCN-742c
  Scenario: Reading is not stopped
    Given the same session, refused
    When the agent reads spec.md
    Then the call is allowed
