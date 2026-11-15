# Delta — harness

## ADDED Requirements

### Requirement: REQ-316 — A role's constraints reach the work they concern

The system SHALL read every `harness/<role>.md` — a front matter with `role`, `owner`, `version` and `applies-to` (`kind`, `capability`, `tag` lists) — and SHALL add to the prompt of each requirement it applies to a "Role constraints" section with its text; a package applies when every dimension it lists matches the requirement, and with no `applies-to` to every requirement.

#### Scenario: SCN-316a — Security constraints on a payment requirement

- GIVEN `harness/security.md` applying to the capability `payments`, and REQ-002 in `payments` and REQ-003 in `fleet`
- WHEN the prompts of REQ-002 and REQ-003 are built
- THEN REQ-002's prompt has the security package under "Role constraints" and REQ-003's has no such section

<!-- specgate:trace status=Implemented test=tests/unit/role-packages.test.ts actor=Developer kind=functional -->

### Requirement: REQ-317 — The report and the live view say which packages were used

The system SHALL name the packages given to an attempt as `role@version` in its `prompt` event and in the run record, show them in the live view of the requirement, and SHALL list in `harness report` each package with the number of requirements it reached.

#### Scenario: SCN-317a — Two runs with the security package

- GIVEN two recorded runs whose results name `security@2`, one of them also `performance@1`
- WHEN `harness report --json` is read and the live model folds a `prompt` event naming `security@2`
- THEN the report lists security@2 for 2 requirements and performance@1 for 1, and the live requirement shows security@2

<!-- specgate:trace status=Implemented test=tests/unit/role-packages.test.ts actor=Developer kind=functional -->

### Requirement: REQ-318 — A reviewer per package, that only advises

The system SHALL ask the builtin review check, when packages apply to the requirement, for one line per package — `- <role>: OK` or `- <role>: ADVICE — …` — and SHALL never fail the review on that advice.

#### Scenario: SCN-318a — The review instruction names each package

- GIVEN the security and performance packages apply to REQ-002
- WHEN the review instruction is written
- THEN it asks for a line for security and one for performance, and says the advice does not decide the verdict

<!-- specgate:trace status=Implemented test=tests/unit/role-packages.test.ts actor=Developer kind=functional -->
