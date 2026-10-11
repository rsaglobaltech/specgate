Feature: The attendee list

  @REQ-308 @SCN-311
  Scenario: The attendee list
    Given "Cloud Congress 2026" with "marta.ruiz@example.com" confirmed with the restriction "vegan"
    When the organiser "ORG-1" lists the registrations of the event
    Then the list shows "Marta Ruiz", "General", "confirmed" and "vegan"
