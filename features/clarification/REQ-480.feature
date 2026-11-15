Feature: A threshold with no value is flagged

  @REQ-480 @SCN-480a
  Scenario: Free shipping above some amount
    Given a brief whose module rule says "Shipping is free above some amount."
    When the developer runs `specgate propose --from-brief --check`
    Then the check reports `B6_unmeasured` for that rule, and none for "Shipping is free above 50 €."
