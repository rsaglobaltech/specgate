# Delta — live-harness

## MODIFIED Requirements

### Requirement: REQ-134 — A guided tour of the loop that leaves the repository untouched

The system SHALL, on `specgate onboard --tour`, run the whole daily loop — `propose`, a requirement in the delta, a test that names it, the approval of the change, `apply`, `archive` and `check` — on a temporary copy of the project, or on a small sample project when the project has no Node test setup, narrating each command and what it proved, and SHALL leave the project itself byte-for-byte unchanged, ending with the command to start for real.

#### Scenario: SCN-134a — The tour on a Node repository

- GIVEN an adopted Node repository
- WHEN the developer runs `specgate onboard --tour`
- THEN the output shows the four verbs, the approval before `apply`, and `check` in order, each passing, and ends naming `specgate propose`
- AND the repository's files are unchanged

<!-- specgate:trace status=Implemented feature=features/live-harness/REQ-134.feature test=tests/unit/live-view.test.ts actor=Developer kind=functional -->
