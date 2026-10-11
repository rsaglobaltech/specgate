Feature: General and VIP

  @REQ-301 @SCN-301
  Scenario: General and VIP
    Given the event "Cloud Congress 2026" of organiser "ORG-1"
    When the organiser creates the ticket types "General" with a quota of 3 and "VIP" with a quota of 1
    Then both are created and the event lists them with their quota and the seats left
