Feature: Settling twice

  @REQ-206 @SCN-208
  Scenario: Settling twice
    Given a SEPA transfer already "completed"
    When the operator "O-001" records the result "rejected"
    Then the response is 409 with the error "transfer_already_settled" and the source balance does not change
