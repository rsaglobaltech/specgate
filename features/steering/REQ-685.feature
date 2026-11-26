Feature: A lesson becomes a principle through an approved change

  @REQ-685 @SCN-685a
  Scenario: A barrier, once approved
    Given the lesson L1 of SCN-684a
    When the Developer runs `specgate learn promote L1 --title "Prices carry their currency" --forbid "price:\s*\d" --in "src/**"`, and a person approves the change learn-prices-carry-their-currency
    Then principles.md has `## P1 — Prices carry their currency` with `forbid="price:\s*\d" in="src/**"`, and before the approval it had no such principle

  @REQ-685 @SCN-685b
  Scenario: An instruction
    Given the lesson L1 of SCN-684a
    When the Developer promotes it with only `--title "Prices carry their currency"` and the change is approved
    Then principles.md has `## P1 — Prices carry their currency` with no `specgate:principle` comment
