Feature: A changed layer is approved again

  @REQ-314 @SCN-314a
  Scenario: The design is rewritten after its approval
    Given a change whose layers were all approved
    When `design.md` is edited
    Then the design waits for an approval again, the change is not approved, and the Discover's approval still counts
