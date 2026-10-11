Feature: The same email twice

  @REQ-302 @SCN-303
  Scenario: The same email twice
    Given "marta.ruiz@example.com" registered for "Cloud Congress 2026"
    When she registers again
    Then the response is 409 with the error "already_registered"
