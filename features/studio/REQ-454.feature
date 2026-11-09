Feature: No feature without its explanation

  @REQ-454 @SCN-454a
  Scenario: An action added without its explanation
    Given a new action in the studio's list with no explanation
    When the project's tests run
    Then they fail, naming the action and the language that lacks it
