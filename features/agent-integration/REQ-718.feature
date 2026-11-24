@change:compat-evidence
Feature: The tool's own session kept

  @REQ-718 @SCN-718a
  Scenario: The test written before the code
    Given a session in which the agent writes test/fees.test.js and then src/fees.js
    When the run is recorded
    Then its line has testFirst true and the two writes in that order

  @REQ-718 @SCN-718b
  Scenario: The code written before its test
    Given a session in which the agent writes src/fees.js and then its test
    When the run is recorded
    Then its line has testFirst false
