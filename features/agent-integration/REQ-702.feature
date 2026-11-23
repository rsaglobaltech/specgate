@change:eval-list
Feature: Every exam listed, with its history

  @REQ-702 @SCN-702a
  Scenario: Two versions of the conventions skill
    Given the exam conventions with a task deliver-req-007 holding a hidden check, examined at version a1 (3/3 correct, good 0.8) then at version b2 (2/3 correct, good 0.8)
    When the Developer runs `specgate eval --list --json`
    Then conventions is listed with its task deliver-req-007 marked hidden, two history rows, and b2 against a1: correct worse, good same
