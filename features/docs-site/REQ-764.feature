Feature: The landing page lists the nine controls and what agents tried

  @REQ-764 @SCN-764a
  Scenario: Both languages
    Given the two landing pages as published
    When a reader looks for the controls
    Then each page lists C1 to C9, and the Spanish one in Spanish
