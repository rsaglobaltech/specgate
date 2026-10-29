Feature: Who approved which version

  @REQ-313 @SCN-313a
  Scenario: The audit after the change is closed
    Given a change whose three layers were approved
    When `approvals.json` is read
    Then it lists one entry per approval with layer, name, email, role, a sha256 hash of that layer and the date
