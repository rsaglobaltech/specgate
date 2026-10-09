Feature: init command
  As a developer
  I want to scaffold a new spec-driven project from a config file
  So that I can start with a fully traceable specification tree

  Background:
    Given a valid project config file

  Scenario: Happy path — generate a complete project skeleton
    When I run "init" with the config file
    Then the command exits with code 0
    And the output directory contains "spec.md"
    And the output directory contains "AGENTS.md"
    And the output directory contains "docs/specs/traceability.md"
    And the output directory contains "README.md"

  Scenario: Dry-run does not write any files
    When I run "init" with "--dry-run"
    Then the command exits with code 0
    And no files are written to the output directory

  Scenario: Missing required config key fails with a clear error
    Given a config file missing "PROJECT_NAME"
    When I run "init" with the incomplete config
    Then the command exits with a non-zero code
    And stderr contains "PROJECT_NAME"

  Scenario: Unknown command shows usage error
    When I run an unknown command "foobar"
    Then the command exits with a non-zero code
    And stderr contains "Unknown command"

  Scenario: Docker Compose files generated when DOCKER_SUPPORT is true
    Given a config file with "DOCKER_SUPPORT" set to "true"
    When I run "init" with the config file
    Then the command exits with code 0
    And the output directory contains "docker-compose.yml"
    And the output directory contains ".env.dev.app"
    And the output directory contains ".env.dev.infra"

  Scenario: Docker Compose files absent when DOCKER_SUPPORT is false
    Given a config file with "DOCKER_SUPPORT" set to "false"
    When I run "init" with the config file
    Then the command exits with code 0
    And the output directory does not contain "docker-compose.yml"

  Scenario: Unsupported DATABASE_ENGINE fails with a clear error
    Given a config file with "DATABASE_ENGINE" set to "mysql"
    When I run "init" with the config file
    Then the command exits with a non-zero code
    And stderr contains "not supported"
