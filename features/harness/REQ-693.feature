@change:lab-fixes
Feature: The harness gate runs the principles

  @REQ-693 @SCN-693a
  Scenario: Code without its requirement's id
    Given P1 `run="! grep -L 'REQ-[0-9]' src/*.js | grep ."` and an agent that writes `src/x.js` without a requirement id
    When the harness gates the attempt
    Then the attempt fails at the stage `principles` naming P1
