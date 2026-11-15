# Delta — harness

## ADDED Requirements

### Requirement: REQ-559 — The lanes are not the roles

The system SHALL refuse a `harness.config.yaml` whose `roles:` is a list — 0.35's spelling of the lanes — naming `lanes: [tester, implementer]` and `specgate migrate 1.0` as the fix, and SHALL never read such a list as the people who hold a role; and `specgate migrate 1.0` SHALL rename that one line to `lanes:`, keeping the rest of the file byte for byte.

#### Scenario: SCN-559a — A 0.35 project's lanes

- GIVEN a committed project whose harness config has the line `roles: [tester, implementer]`
- WHEN a developer runs `specgate migrate 1.0`
- THEN the line reads `lanes: [tester, implementer]`, every other byte of the file is unchanged, and the report still asks who holds product, architect and developer

<!-- specgate:trace status=Implemented feature=features/harness/REQ-559.feature actor=Developer kind=functional -->

## MODIFIED Requirements

### Requirement: REQ-532 — A tester and an implementer, as separate sessions

The system SHALL, when `harness.config.yaml` sets `lanes: [tester, implementer]`, run each attempt as two agent sessions in the requirement's worktree, in that order: the tester, told to write the failing tests the requirement's scenarios call for and no production code, then the implementer, told to make those tests pass without changing them; each session SHALL get `SPECGATE_LANE` set to its lane in its environment and its role in the run's attempt log; and without `lanes:` the harness SHALL keep a single session per attempt.

#### Scenario: SCN-532a — Two sessions, in order

- GIVEN a project whose harness config sets `lanes: [tester, implementer]` and an agent that appends `SPECGATE_ROLE` to a log outside the worktree
- WHEN a tool runs `specgate harness run --req REQ-000`
- THEN the log holds `tester` then `implementer`, and the run's attempt log names both roles

<!-- specgate:trace status=Implemented feature=features/harness/REQ-532.feature actor=Developer kind=functional -->
