@change:outside-judge
Feature: A requirement of a change nobody approved is not delivered

  @REQ-745 @SCN-745a
  Scenario: Its own requirement
    Given export-loans open with REQ-005, written in the session and approved by nobody
    When `specgate apply REQ-005` runs with the gate green
    Then apply fails with `change_not_approved` naming export-loans, and REQ-005 stays as it was

  @REQ-745 @SCN-745b
  Scenario: An approved change is delivered
    Given the same change, approved
    When `specgate apply REQ-005` runs
    Then REQ-005 is delivered

  @REQ-745 @SCN-745c
  Scenario: A project that asks for no approvals
    Given the change of SCN-745a and `approvals: { required: never }`
    When `specgate apply REQ-005` runs
    Then REQ-005 is delivered

  @REQ-745 @SCN-745d
  Scenario: No change owns it
    Given REQ-001 written straight into spec.md
    When `specgate apply REQ-001` runs
    Then apply says nothing of approvals
