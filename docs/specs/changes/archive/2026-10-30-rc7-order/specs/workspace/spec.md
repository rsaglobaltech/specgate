# Delta — workspace

## ADDED Requirements

### Requirement: REQ-395 — A part is written after the contracts it uses

The system SHALL refuse, with `author_contracts_first`, `change author` of the specs, design or tasks of a story's sub-change in a repository that is not the contracts repository and shares a criterion of the story with it, while the contracts repository's sub-change of the story has no requirement; `--force` and `--dry-run` SHALL skip the refusal, and a story that maps no criteria shares them all.

#### Scenario: SCN-395a — Tracking's design waits for the contracts

- GIVEN the story track-fleet gives AC-1 to contracts and to tracking, and contracts' part has no requirement
- WHEN the developer runs `specgate change author track-fleet --artifact design` in tracking
- THEN it fails with `author_contracts_first`, naming contracts and `--force`; with `--force` it writes, and once contracts' part has a requirement it writes without it

<!-- specgate:trace actor=Developer kind=functional status=Implemented feature=features/workspace/REQ-395.feature test=tests/unit/rc7-order.test.ts -->

### Requirement: REQ-396 — A waiting requirement of an open change is the build order

The system SHALL report `workspace_dependency_pending` as a warning, under the workspace's warnings, when the requirement that depends on another repository's undelivered requirement is itself in an open change and not delivered; for any other requirement it SHALL stay an error.

#### Scenario: SCN-396a — Tracking's open change waits for contracts:REQ-002

- GIVEN tracking's open change track-fleet has REQ-002 with `depends=contracts:REQ-002`, and contracts' REQ-002 is Draft
- WHEN the developer runs `specgate workspace check --json`
- THEN `workspace_dependency_pending` is not among the errors, and is one warning naming tracking:REQ-002 and contracts:REQ-002

<!-- specgate:trace actor=Developer kind=functional status=Implemented feature=features/workspace/REQ-396.feature test=tests/unit/rc7-order.test.ts -->
