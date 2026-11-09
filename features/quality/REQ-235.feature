Feature: Quality presets for each application folder

  @REQ-235 @SCN-235a
  Scenario: A Spring Boot API in apps/api beside a Node root
    Given a repository with `package.json` and `package-lock.json` at the root, and `apps/api/pom.xml` declaring Java 21
    When `specgate quality init --level strict` runs
    Then its checks include `coverage`, `spotbugs` and `pmd`, each running `cd apps/api && mvn` in `maven:3.9-eclipse-temurin-21`, coverage reads `apps/api/target/site/jacoco/jacoco.xml`, and one `semgrep` check carries both `p/java` and `p/typescript`

  @REQ-235 @SCN-235b
  Scenario: The changed files of one folder
    Given the changed files `apps/api/src/main/java/eu/fleet/Truck.java` and `apps/web/src/map.ts`
    When a check's command uses `{changed_classes@apps/api}` and `{changed_src@apps/web}`
    Then they become `eu.fleet.Truck` and `src/map.ts`
