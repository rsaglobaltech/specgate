@change:show-use-cases
Feature: `change show --json` carries the change's use cases

  @REQ-628 @SCN-628a
  Scenario: A change's use cases shown
    Given a change whose use-cases.md adds UC-004 "Create a child profile" for Tutor with REQ-001 and REQ-002, and removes UC-002 "Merged into UC-004"
    When a client runs `specgate change show <id> --json`
    Then `change.useCases` has UC-004 with its name, actor and requirements under added, nothing under modified, and UC-002 with its reason under removed; a change with no use-cases.md has `null`
