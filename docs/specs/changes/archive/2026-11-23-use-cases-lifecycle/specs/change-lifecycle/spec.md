# Delta — change-lifecycle

## ADDED Requirements

### Requirement: REQ-625 — A change carries its use cases, and archive merges them into the catalog

<!-- specgate:trace status=Implemented feature=features/change-lifecycle/REQ-625.feature actor=Developer kind=functional -->

The system SHALL read a change's `use-cases.md` — `## ADDED Use Cases` and `## MODIFIED Use Cases` tables of `| ID | Use Case | Actor | Requirements |`, and `## REMOVED Use Cases` of `| ID | Reason |` — and SHALL refuse to archive it when an id is no `UC-NNN` or repeats, an added id is in `docs/specs/use-cases.md` already, a modified or removed id is not, a use case has no name or no requirement, or a removed use case is still named by a requirement once the change is applied; otherwise archive SHALL merge it into `docs/specs/use-cases.md` — an added or modified row replacing the row with its id and keeping its command, aggregate and events, a removed id dropped, the template's placeholder row gone once a real use case is there — and list the catalog among its writes, `--dry-run` included. A change with no `use-cases.md` SHALL archive as before.

> #543: `init` wrote use-cases.md and AGENTS.md named it, and nothing ever filled it or checked it; 134 requirements of a project went through the gate with no use case.

#### Scenario: SCN-625a — A use case added

- GIVEN a change adding UC-007 "Price a session at peak time" for Driver with REQ-001, and a catalog holding the template's row and UC-002
- WHEN the Developer archives it
- THEN docs/specs/use-cases.md has UC-007 with REQ-001 and Approved, still UC-002, and no template row; the plan lists the catalog among its writes

#### Scenario: SCN-625b — A use case modified

- GIVEN UC-003 in the catalog with its command, aggregate and events, and a change modifying UC-003's name and requirements
- WHEN the change is archived
- THEN UC-003's row has its new name and requirements, and the same command, aggregate and events

#### Scenario: SCN-625c — A use case removed while a requirement names it

- GIVEN UC-002 named by REQ-000, and a change removing UC-002
- WHEN the Developer archives it
- THEN the archive is refused with `uc_removed_in_use` naming REQ-000, and the catalog is untouched

### Requirement: REQ-626 — A draft carries its use cases, and every requirement names one

<!-- specgate:trace status=Implemented feature=features/change-lifecycle/REQ-626.feature actor=Developer kind=functional -->

The system SHALL open a draft from a brief with `use-cases.md` and a reserved `uc_range` in `change.yaml` — as many use case ids as requirement ids, past every id the catalog, a change or another branch uses — and SHALL tell the agent, in `DRAFTING.md`, to write `uc=` in each requirement's trace and the use cases under `## ADDED Use Cases`; and SHALL keep a draft that has `use-cases.md` from ready while a requirement names no use case (`D14_no_use_case`), names one neither the change nor the catalog has (`D14_unknown_use_case`), or is listed by a use case it does not name (`D14_use_case_mismatch`), or while its use cases have the faults REQ-625 refuses. A draft opened with no `use-cases.md` SHALL be checked as before.

#### Scenario: SCN-626a — A draft opens with its use cases

- GIVEN a brief with the module bookings
- WHEN the Developer runs `specgate draft bookings`
- THEN the change has use-cases.md with an empty `## ADDED Use Cases` table, change.yaml has `uc_range`, and DRAFTING.md shows `uc=` with the first id and a section on use-cases.md

#### Scenario: SCN-626b — A requirement with no use case

- GIVEN the draft's REQ-002 with no `uc=`, and use-cases.md listing UC-900 with REQ-002
- WHEN the Developer checks the draft
- THEN it is not ready, with `D14_no_use_case` and `D14_use_case_mismatch`; with `uc=UC-901` it has `D14_unknown_use_case`; with `uc=UC-900` it is ready to review

### Requirement: REQ-627 — The gate checks every requirement maps to a use case

<!-- specgate:trace status=Implemented feature=features/change-lifecycle/REQ-627.feature actor=Developer kind=functional -->

The system SHALL have a gate rule `use_cases` — `warning` in the strict and standard presets and with no policy, `off` in minimal — which, in a project with `docs/specs/use-cases.md`, reports every requirement of the matrix whose Use Case is no `UC-NNN` (`use_case_missing`) or names one the catalog does not have (`use_case_unknown`), every use case no requirement delivers (`use_case_undelivered`), and the template's row left once there is a requirement (`use_case_template`); `REQ-000` and the adopted code's baseline are not asked for one. A project with no catalog SHALL get nothing from it.

#### Scenario: SCN-627a — Reported by default

- GIVEN a project with the template catalog and REQ-002 with no use case
- WHEN the Developer runs `specgate validate . --strict`
- THEN it passes, and reports `use_case_missing` for REQ-002

#### Scenario: SCN-627b — Failed when set to error

- GIVEN the same project with `use_cases: error` in .specgate/gate.yaml
- WHEN the Developer runs `specgate validate . --strict`
- THEN it fails with `use_case_missing` and `use_case_template`; with `use_cases: off` it says nothing of them

#### Scenario: SCN-627c — What the rule names

- GIVEN a matrix with REQ-002 naming no use case, REQ-003 naming UC-077 the catalog does not have, and UC-003 no requirement delivers
- WHEN the rule runs
- THEN it names REQ-002 `use_case_missing`, REQ-003 `use_case_unknown` and UC-003 `use_case_undelivered`
