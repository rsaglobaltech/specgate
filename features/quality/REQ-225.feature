Feature: The checks of a level, for the project's stack

  @REQ-225 @SCN-225a
  Scenario: Strict for a Maven project
    Given a pom.xml declaring Java 17 and no pitest-maven
    When `specgate quality init --level strict` runs
    Then the file lists secrets, dependencies, coverage, spotbugs, pmd and semgrep in Docker, the Maven ones in `maven:3.9-eclipse-temurin-17`, and mutation commented with pitest-maven named

  @REQ-225 @SCN-225b
  Scenario: A Node project with pnpm and Vitest
    Given a package.json with typescript, eslint, vitest and @vitest/coverage-v8, and a pnpm-lock.yaml
    When `specgate quality init` runs
    Then types, lint and coverage run in `node:22` after a pnpm install, coverage reads lcov, and dependencies scans pnpm-lock.yaml

  @REQ-225 @SCN-225c
  Scenario: The rest of the file is kept, the checks are not replaced unasked
    Given harness.config.yaml with test_cmd and existing checks
    When `specgate quality init` runs, then with `--force`
    Then the first is refused and changes nothing; the second keeps test_cmd and replaces the checks
