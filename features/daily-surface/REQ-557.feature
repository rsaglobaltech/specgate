Feature: A requirement an open change removes owes nothing to validate

  @REQ-557 @SCN-557a
  Scenario: Removing a delivered requirement
    Given a delivered requirement with a feature file and a test, and an open change that removes it
    When its feature file and its test are deleted, and a developer runs `specgate validate . --strict`
    Then it passes, with no `declared_artifact_missing` and no strict-TDD violation for that requirement
