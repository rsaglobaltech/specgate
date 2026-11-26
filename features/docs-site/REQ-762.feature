Feature: The landing page shows the agent without and with the gate

  @REQ-762 @SCN-762a
  Scenario: The first screen
    Given the landing page as published
    When a reader opens it
    Then before any other section it shows "Without Specgate" with 44% (16 of 36) and "With Specgate" with 92% (33 of 36) and p < 0.001
