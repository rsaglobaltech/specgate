Feature: The baseline of adopted code is not work to do

  @REQ-612 @SCN-612a
  Scenario: After adoption
    Given a project with code, just adopted
    When the developer runs `specgate status` and `specgate status --json`
    Then the text says `0 of 0 done` and `REQ-001 Preserve existing behaviour: your test suite holds it on every check`, says `To close it, name REQ-001 in a test that starts the product`, has no "To do" list, and the JSON counts 1 requirement

  @REQ-612 @SCN-612b
  Scenario: No code
    Given an empty folder, just adopted
    When the developer runs `specgate status`
    Then it says `0 of 1 done` and lists REQ-001 under "To do"
