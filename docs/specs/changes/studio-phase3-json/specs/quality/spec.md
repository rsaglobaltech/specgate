# Delta — quality

## ADDED Requirements

### Requirement: REQ-501 — The coverage report for one capability

The system SHALL accept `--capability <name>` on `specgate report`, in HTML and JSON alike, and then count and list only the requirements of that capability — as `status --json` assigns them (REQ-500) — naming it as `capability` in the JSON report; and SHALL refuse a capability the project does not have with `capability_unknown`, exit 2, whose fix lists the capabilities it has.

#### Scenario: SCN-501a — The orders capability, then one that does not exist

- GIVEN a project with REQ-001 in spec.md and REQ-002 and REQ-003 in the capability `orders`
- WHEN a tool runs `specgate report --format json --stdout --capability orders`, then `--capability nothing`
- THEN the first report has `capability` `orders`, a total of 2 and only REQ-002 and REQ-003; the second exits 2 with `capability_unknown` and a fix that names `orders`

<!-- specgate:trace status=Implemented actor=Developer kind=functional -->

### Requirement: REQ-499 — The coverage report gives the project's line coverage

The system SHALL give in `specgate report --format json` and the API's `report(dir)` `coverage.lines`: the share of executable lines the project's tests run, as `percent` with the `covered` and `total` lines, the `tool` whose report it was read from (`lcov`, `istanbul`, `cobertura` or `jacoco`), that report's `file` and when it was written as `measuredAt` — read from the report a quality check names in `report:`, else from the newest of the standard reports (`coverage/lcov.info`, `coverage/coverage-summary.json`, `coverage/cobertura-coverage.xml`, `coverage.xml`, `target/site/jacoco/jacoco.xml`, `build/reports/jacoco/test/jacocoTestReport.xml`); and, when no report exists or it measures no line, `coverage.lines` null with the finding `coverage_not_measured` whose fix says how to have the project's stack write one — never 0 for a coverage nothing measured.

#### Scenario: SCN-499a — An LCOV report, then none

- GIVEN a Node project whose `coverage/lcov.info` has 8 of its 10 executable lines covered
- WHEN a tool runs `specgate report --format json --stdout` and calls `report(dir)`, then removes the report and runs it again
- THEN both first answers have `coverage.lines` with `percent` 80, `covered` 8, `total` 10, `tool` `lcov`, `file` `coverage/lcov.info` and `measuredAt`; the last has `coverage.lines` null and `coverage_not_measured` with a fix that names c8

<!-- specgate:trace status=Implemented actor=Developer kind=functional -->
