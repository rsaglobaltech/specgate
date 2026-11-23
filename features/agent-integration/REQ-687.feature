@change:skill-evals
Feature: Each exam kept per version of the skill, and compared

  @REQ-687 @SCN-687a
  Scenario: A new version that does worse
    Given the skill `orders` examined at 100 % correct, then its text changed so that the agent fails half the tasks
    When the Developer runs `specgate eval orders --json` again
    Then the history holds both versions, and the result says correct is `worse` than the previous version, from 100 % to 50 %
