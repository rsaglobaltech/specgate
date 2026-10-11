Feature: The author cannot approve

  @REQ-706 @SCN-708
  Scenario: The author cannot approve
    Given a supervisor who created an adjustment of +15 minutes
    When the same supervisor approves it
    Then the response is 403 with the error "approver_must_differ"
