@change:draft-fee-cap
Feature: The cap depends on the member

  @REQ-003 @SCN-003a
  Scenario: A child's cap
    Given a child member's book returned 30 days late
    When the fee is computed
    Then the fee is 5.00

  @REQ-003 @SCN-003b
  Scenario: An adult's cap is unchanged
    Given an adult member's book returned 30 days late
    When the fee is computed
    Then the fee is 10.00
