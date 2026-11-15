# Delta — steering

## Purpose

The organization's principles, the version each repository follows, the
principles the gate can check, and the behaviour changed without a
specification.

## ADDED Requirements

### Requirement: REQ-330 — The gate names the principles a repository follows

The system SHALL read `docs/specs/principles.md` — the organization's principles, with `principles_version` and an optional `source` in its front matter — and SHALL, on `specgate check`, report the version the repository follows and, when `source` is a principles file with a higher version, warn `principles_behind` with both versions and how to update.

#### Scenario: SCN-330a — The workspace raised its principles

- GIVEN a repository whose principles.md says `principles_version: 1.0.0` and `source: ../ws/principles.md`, and that file says `principles_version: 1.1.0`
- WHEN the developer runs `specgate check --json`
- THEN the gate passes, its result names the principles version 1.0.0, and a warning `principles_behind` names 1.0.0 and 1.1.0

#### Scenario: SCN-330b — Up to date

- GIVEN the same repository after its principles.md says `principles_version: 1.1.0`
- WHEN the developer runs `specgate check --json`
- THEN no warning `principles_behind` is given

<!-- specgate:trace status=Implemented test=tests/unit/org-steering.test.ts actor=Developer kind=functional -->

### Requirement: REQ-331 — A principle can be checked by the gate

The system SHALL run, on `specgate check`, the machine check of each principle — `<!-- specgate:principle run="<command>" -->`, passing when the command exits 0, or `forbid="<regex>" in="<glob>"`, passing when no tracked file the glob matches contains the pattern — and SHALL fail the gate with `principle_failed` naming the principle, and the file and line for a pattern; a principle with `level=warn` warns instead.

#### Scenario: SCN-331a — A forbidden pattern in the code

- GIVEN principle P1 says `forbid="password\s*=\s*\"" in="src/**"` and src/config.ts holds `password = "x"`
- WHEN the developer runs `specgate check --json`
- THEN the gate fails with `principle_failed` naming P1 and src/config.ts:1

#### Scenario: SCN-331b — A principle given as advice

- GIVEN principle P2 says `run="node -e process.exit(3)" level=warn`, and principle P3 says `run="node -e process.exit(0)"`
- WHEN the developer runs `specgate check --json`
- THEN the gate passes with a warning `principle_failed` naming P2, and nothing about P3

<!-- specgate:trace status=Implemented test=tests/unit/org-steering.test.ts actor=Developer kind=functional -->

### Requirement: REQ-332 — Principles delivered by a pack

The system SHALL accept principles that a domain pack writes to `docs/specs/principles.md` with `source: pack:<pack_id>`, compare the version the repository follows with the version of that pack in its source when the pack's repository is a local folder, and warn `principles_behind` naming `specgate specops sync` as the update.

#### Scenario: SCN-332a — The organization released its principles pack 2.0.0

- GIVEN principles.md says `principles_version: 1.0.0` and `source: pack:principles`, `.specops.lock` records the pack principles from a local folder whose pack.yaml now says version 2.0.0
- WHEN the developer runs `specgate check --json`
- THEN a warning `principles_behind` names 1.0.0, 2.0.0 and `specgate specops sync`

<!-- specgate:trace status=Implemented test=tests/unit/org-steering.test.ts actor=Developer kind=functional -->

### Requirement: REQ-333 — Behaviour changed without a specification is reported

The system SHALL list, on `specgate check` and `specgate drift`, each commit since the base that changes production code while its message names no requirement (`REQ-NNN`) and no test file it changes names one, as the warning `spec_drift` naming the commit and its files; tests, specifications, features, documentation and build configuration are not production code.

#### Scenario: SCN-333a — A quick fix without a requirement

- GIVEN, since the base, a commit "fix totals" that changes src/billing.ts, a commit "feat(REQ-004): totals" that changes src/totals.ts, and a commit "round" that changes src/round.ts with tests/round.test.ts naming REQ-005
- WHEN the developer runs `specgate drift --json`
- THEN it exits 0 and lists only the commit "fix totals" with src/billing.ts

<!-- specgate:trace status=Implemented test=tests/unit/org-steering.test.ts actor=Developer kind=functional -->

### Requirement: REQ-334 — Drift can block the merge

The system SHALL make `spec_drift` an error that fails `specgate check` and `specgate drift` when harness.config.yaml sets `drift: gate`.

#### Scenario: SCN-334a — The team makes drift a gate

- GIVEN the commit "fix totals" of SCN-333a and `drift: gate` in harness.config.yaml
- WHEN the developer runs `specgate drift --json`
- THEN it exits 1 with the error `spec_drift`

<!-- specgate:trace status=Implemented test=tests/unit/org-steering.test.ts actor=Developer kind=functional -->
