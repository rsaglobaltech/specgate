# specgate:allow-placeholders — this scenario feeds the validator a placeholder on purpose.
Feature: validate command
  As a developer
  I want to validate my spec tree against quality gates
  So that I catch incomplete or inconsistent specifications early

  Scenario: Validates a freshly generated project successfully
    Given a project generated with valid config
    When I run "validate" on that project
    Then the command exits with code 0
    And stdout contains "valid" or "passed" or "completed"

  Scenario: Fails when project directory argument is missing
    When I run "validate" with no arguments
    Then the command exits with a non-zero code
    And stderr contains "project"

  Scenario: Fails when required files are absent
    Given a project directory missing "spec.md"
    When I run "validate" on that project
    Then the command exits with a non-zero code

  Scenario: Fails when unresolved placeholders exist
    Given a project with "{{PLACEHOLDER}}" in a spec file
    When I run "validate" on that project
    Then the command exits with a non-zero code
    And stderr contains "placeholder" or "PLACEHOLDER"
