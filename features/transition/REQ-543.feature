Feature: Acceptance is a checklist a person signs

  @REQ-543 @SCN-543a
  Scenario: Signed only when every item is checked
    Given a change with REQ-007 `Implemented` and two scenarios
    When a tool runs `specgate acceptance pdf-invoices`, checks one item, runs `--sign "Ana Pérez"`, checks the other and runs `--sign "Ana Pérez"` again
    Then the first sign is refused with `acceptance_incomplete`; after the second, the file records the name and date and REQ-007 is `Verified`
