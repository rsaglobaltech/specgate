# Delta — quality

## ADDED Requirements

### Requirement: REQ-235 — Quality presets for each application folder

The system SHALL, on `specgate quality init`, write the checks of a stack for each application folder that has its own build file — the root, a folder one level down, or a folder in `apps/`, `packages/` or `services/` — when the root has no build file of that stack; each such check SHALL run in its folder, with its report and SARIF paths written from the root; one Semgrep scan SHALL carry the rules of every stack found; and `{changed_classes@<folder>}` and `{changed_src@<folder>}` SHALL give only the changed files under that folder, relative to it.

#### Scenario: SCN-235a — A Spring Boot API in apps/api beside a Node root

- GIVEN a repository with `package.json` and `package-lock.json` at the root, and `apps/api/pom.xml` declaring Java 21
- WHEN `specgate quality init --level strict` runs
- THEN its checks include `coverage`, `spotbugs` and `pmd`, each running `cd apps/api && mvn` in `maven:3.9-eclipse-temurin-21`, coverage reads `apps/api/target/site/jacoco/jacoco.xml`, and one `semgrep` check carries both `p/java` and `p/typescript`

#### Scenario: SCN-235b — The changed files of one folder

- GIVEN the changed files `apps/api/src/main/java/eu/fleet/Truck.java` and `apps/web/src/map.ts`
- WHEN a check's command uses `{changed_classes@apps/api}` and `{changed_src@apps/web}`
- THEN they become `eu.fleet.Truck` and `src/map.ts`

<!-- specgate:trace status=Implemented test=tests/unit/quality-presets.test.ts actor=Developer kind=functional -->

### Requirement: REQ-237 — Maven dependencies are scanned from the build's own bill of materials

The system SHALL, in the Maven preset, scan dependencies from a CycloneDX bill of materials that Maven writes in the project's image (`sbom`, then `dependencies` reading `target/bom.json` with osv-scanner), so the versions a parent POM or a BOM manages are the ones scanned, with Maven's own repositories and cache.

#### Scenario: SCN-237a — A Spring Boot parent manages the versions

- GIVEN a Maven project whose dependencies take their versions from `spring-boot-starter-parent`
- WHEN `specgate quality init` writes its checks
- THEN an `sbom` check runs the CycloneDX Maven plugin to `target/bom.json` before `dependencies`, which runs osv-scanner on `target/bom.json`

<!-- specgate:trace status=Implemented test=tests/unit/quality-presets.test.ts actor=Developer kind=functional -->

### Requirement: REQ-238 — A check may reach Docker, for tests that start containers

The system SHALL accept `docker: true` on a check run in Docker, giving its container the host's Docker socket and what Testcontainers needs to reach the containers it starts; and the Maven and Gradle presets SHALL set it on the checks that run the tests when the build declares Testcontainers.

#### Scenario: SCN-238a — Spring Boot tests with Testcontainers

- GIVEN a `pom.xml` that declares `org.testcontainers`
- WHEN the coverage check's container command line is built
- THEN it mounts `/var/run/docker.sock` and sets `TESTCONTAINERS_HOST_OVERRIDE=host.docker.internal`, and a check without `docker: true` mounts no socket

<!-- specgate:trace status=Implemented test=tests/unit/quality-checks.test.ts actor=Developer kind=functional -->

### Requirement: REQ-239 — The JSON of a quality run says why a check failed

The system SHALL include, in each outcome of `specgate quality run --json`, the last lines of what the check printed, so a failure can be read without running the tool again.

#### Scenario: SCN-239a — A check that exits 1

- GIVEN a check whose command prints "boom" and exits 1
- WHEN `specgate quality run --json` runs it
- THEN its outcome has `ok: false` and an `output` that contains "boom"

<!-- specgate:trace status=Implemented test=tests/unit/quality-checks.test.ts actor=Developer kind=functional -->
