Feature: On main, the evidence compares with the commit before the change

  @REQ-821 @SCN-821a
  Scenario: Delivered on main
    Given a project on `main` whose change `draft-orders` was committed, then `Orders.refund()` added in a later commit
    When the Developer runs `specgate evidence draft-orders`
    Then EVIDENCE.md says "Changed: `Orders` — added `+refund()`", not "Unchanged since the base"
