Feature: A slot without seats is not offered

  @REQ-502 @SCN-503
  Scenario: A slot without seats is not offered
    Given the calendar "Hair" with no seats on Sunday
    When a customer asks for free times on Sunday
    Then no time is offered
