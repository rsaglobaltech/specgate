Feature: ci status says what the gate checks and what it lacks

  @REQ-460 @SCN-460a
  Scenario: An old specs.yml
    Given a project whose only CI file is the old `specs.yml` running `validate .`
    When `specgate ci status` runs
    Then it lists the specification as present, and the tests, the architecture, the three systems, the ids against the base, the pack drift and the plan as missing, each with how to add it
