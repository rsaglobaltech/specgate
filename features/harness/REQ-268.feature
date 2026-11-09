Feature: Every prompt reads the requirement where the harness found it

  @REQ-268 @SCN-268a
  Scenario: The review of a draft's requirement
    Given REQ-005 is written only in the open change `draft-flota`
    When the harness builds the reviewer's prompt for REQ-005
    Then the prompt holds REQ-005's statement, and does not say that `spec.md` has no section for it
