# Delta — quality

## ADDED Requirements

### Requirement: REQ-241 — A finding in a file git ignores is not the repository's

The system SHALL leave out of a check's findings, and of the baseline, the findings in files that git ignores, since they are never part of a change or of the repository.

#### Scenario: SCN-241a — A development secret in .env.local

- GIVEN `.gitignore` lists `.env.local`, and a secrets scan reports a finding in `apps/web/.env.local` and one in `src/config.ts`
- WHEN the check's SARIF is read
- THEN only the finding in `src/config.ts` is counted

<!-- specgate:trace status=Implemented test=tests/unit/quality-baseline.test.ts actor=Developer kind=functional -->

### Requirement: REQ-250 — Maven coverage instruments the project's own classes

The system SHALL, in the Maven preset, run the coverage check with JaCoCo's agent instrumenting only the classes of the project's group (`includes=<groupId>.*`), taken from its `pom.xml`, so libraries such as Testcontainers are not instrumented; and SHALL fall back to every class when the pom names no group.

#### Scenario: SCN-250a — A Spring Boot API whose group is eu.truckflote

- GIVEN `apps/api/pom.xml` with `<groupId>eu.truckflote</groupId>` below its Spring Boot `<parent>`
- WHEN `specgate quality init` writes the coverage check
- THEN its command loads JaCoCo's agent with `includes=eu.truckflote.*`, and its report is still `apps/api/target/site/jacoco/jacoco.xml`

<!-- specgate:trace status=Implemented test=tests/unit/quality-presets.test.ts actor=Developer kind=functional -->
