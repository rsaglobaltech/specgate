Feature: No pass that was not said, and a timeout said as one

  @REQ-581 @SCN-581a
  Scenario: A reviewer that answers without a verdict
    Given a gating review check whose reviewer prints no `VERDICT:` line
    When the harness delivers a requirement
    Then the requirement fails and the report says the reviewer gave no verdict
