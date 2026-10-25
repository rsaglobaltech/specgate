# Delta — daily-surface

## ADDED Requirements

### Requirement: REQ-173 — Approved owes a test, as the strict gate says

The system SHALL refuse `specgate apply` and `specgate done` with a `--status` that is not Draft, Approved, Implemented, Verified, Released or Deprecated, and SHALL refuse a status that owes a test under TDD-1 (Approved, Implemented, Verified, Released) while no test names the requirement, naming TDD-1 and the fix and writing nothing; with `--no-check` the status is written and a warning says that `validate --strict` fails TDD-1 until a test names the requirement.

#### Scenario: SCN-173a — Approved before the test is refused

- GIVEN a project with REQ-002 in Draft and no test that names it
- WHEN the developer runs `specgate apply REQ-002 --status Approved`
- THEN the command exits 1 naming TDD-1 and the fix "write a test that names REQ-002", and REQ-002 is still Draft

#### Scenario: SCN-173b — Approved once a test names it

- GIVEN the same project with a test that names REQ-002 and SCN-002
- WHEN the developer runs `specgate apply REQ-002 --status Approved`
- THEN REQ-002 is Approved

#### Scenario: SCN-173c — An unknown status is refused

- GIVEN the same project
- WHEN the developer runs `specgate apply REQ-002 --status Aproved`
- THEN the command exits 2 naming the statuses it accepts, and REQ-002 is still Draft

#### Scenario: SCN-173d — `--no-check` writes it and warns

- GIVEN the project with no test that names REQ-002
- WHEN the developer runs `specgate apply REQ-002 --status Approved --no-check`
- THEN REQ-002 is Approved and stderr warns that `validate --strict` fails TDD-1 until a test names REQ-002

<!-- specgate:trace status=Draft test=tests/unit/approved-needs-test.test.ts actor=Developer kind=functional -->
