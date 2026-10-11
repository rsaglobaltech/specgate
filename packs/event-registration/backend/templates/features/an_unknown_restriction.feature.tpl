Feature: An unknown restriction

  @REQ-303 @SCN-305
  Scenario: An unknown restriction
    Given "Cloud Congress 2026" published with the ticket type "General"
    When "marta.ruiz@example.com" registers with the restriction "paleo"
    Then the response is 422 with the error "invalid_restriction"
