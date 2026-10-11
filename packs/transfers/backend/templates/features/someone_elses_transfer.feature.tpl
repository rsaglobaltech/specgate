Feature: Someone else's transfer

  @REQ-209 @SCN-212
  Scenario: Someone else's transfer
    Given a transfer ordered by customer "C-001"
    When customer "C-003" GETs it
    Then the response is 404 with the error "transfer_not_found"
