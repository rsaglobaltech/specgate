Feature: An unpublished event

  @REQ-302 @SCN-304
  Scenario: An unpublished event
    Given "Retail Fair 2027" still in "draft"
    When "marta.ruiz@example.com" registers for it
    Then the response is 404 with the error "event_not_found"
