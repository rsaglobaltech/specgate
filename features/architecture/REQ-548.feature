Feature: The stack file names the layers and their commands

  @REQ-548 @SCN-548a
  Scenario: A Spring and Flyway project
    Given a Maven project with Spring Boot, Flyway migrations under `src/main/resources/db/migration` and no `test_cmd` configured
    When a tool runs `specgate stack` twice, then `specgate check --json`
    Then `stack.md` lists `migration` as Flyway and `service` as Spring Boot with their evidence, the second run changes nothing, and `check` runs the stack file's test command
