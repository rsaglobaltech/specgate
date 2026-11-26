Feature: The lessons that keep coming back

  @REQ-684 @SCN-684a
  Scenario: The same note in two drafts
    Given draft-pedidos with the review note "Prices always with their currency, never a bare number" and draft-pagos with "Show every price with its currency, not a bare number"
    When the Developer runs `specgate learn --json`
    Then L1 is a lesson `review` with both notes and their changes, and its next command is `specgate learn promote L1 --title "<rule>"`

  @REQ-684 @SCN-684b
  Scenario: The agent keeps failing the architecture check
    Given harness events where the stage `architecture` failed in two attempts of REQ-040 and one of REQ-041
    When the Developer runs `specgate learn --json`
    Then a lesson `harness` names the stage `architecture`, 3 failures and REQ-040 and REQ-041
