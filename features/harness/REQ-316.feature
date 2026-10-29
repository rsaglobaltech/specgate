Feature: A role's constraints reach the work they concern

  @REQ-316 @SCN-316a
  Scenario: Security constraints on a payment requirement
    Given `harness/security.md` applying to the capability `payments`, and REQ-002 in `payments` and REQ-003 in `fleet`
    When the prompts of REQ-002 and REQ-003 are built
    Then REQ-002's prompt has the security package under "Role constraints" and REQ-003's has no such section
