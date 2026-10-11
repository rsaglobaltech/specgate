Feature: Registering with a restriction

  @REQ-302 @SCN-302
  Scenario: Registering with a restriction
    Given "Cloud Congress 2026" published with the ticket type "General" (quota 3)
    When "marta.ruiz@example.com" registers as "Marta Ruiz" for "General" with the restriction "vegan"
    Then the registration is "confirmed" and "General" has 2 seats left
