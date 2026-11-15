Feature: The studio says what it is doing and what went wrong

  @REQ-434 @SCN-434a
  Scenario: The server goes away and comes back
    Given the studio open on Questions
    When its server stops and starts again
    Then the page says it is reconnecting, keeps the questions shown, and says it is connected once the server answers
