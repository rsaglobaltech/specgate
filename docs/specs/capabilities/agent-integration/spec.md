# Agent Integration

## Requirements

### Requirement: REQ-426 — The guards name the next requirement as the change's tasks order it

The guard's denial (REQ-421, REQ-422) and the session context (REQ-420) SHALL name as the next requirement of an open change the first requirement, not yet Implemented, that an unchecked line of the change's `tasks.md` names, in the file's order; requirements no unchecked line names SHALL follow in the order the deltas declare them. Without a `tasks.md`, the deltas' order SHALL apply. The denial SHALL say that a test, new or modified in the working tree, naming any requirement of the change unlocks the file.

> Session 2026-11-08, agentkit `module-map-v2`: `tasks.md` put REQ-320 next; the denial said "write the test for REQ-311 first".

#### Scenario: SCN-426a — The next requirement by the tasks

- GIVEN an open change `module-map-v2` whose delta declares REQ-311, REQ-312, REQ-313, REQ-319 and REQ-320, REQ-313 and REQ-319 Implemented, and whose `tasks.md` has "REQ-313" and "REQ-319" checked and then, unchecked, "REQ-320", "REQ-312", "REQ-311"
- WHEN the agent tries to write `src/core/map/scan.ts` with no test in the working tree naming a requirement of the change
- THEN the edit is denied with "write the test for REQ-320 first" and "a test that names any requirement of `module-map-v2`", and the session context says the next requirement is REQ-320

<!-- specgate:trace actor=Developer feature=features/agent-integration/REQ-426.feature kind=functional status=Implemented -->

### Requirement: REQ-427 — With every requirement applied, the guard names none

When every requirement of every open change is Implemented (or later), the guard's denial SHALL name no requirement: it SHALL say that the change is ready for its reviewer and `specgate archive <change-id>` once they agree, or `specgate propose <change-id>` for new work.

#### Scenario: SCN-427a — Nothing left to apply

- GIVEN an open change `module-map` whose requirements are all Implemented
- WHEN the agent tries to write `src/core/map/scan.ts`
- THEN the edit is denied with "every requirement of `module-map` is applied" and the two commands, and no REQ id

<!-- specgate:trace actor=Developer feature=features/agent-integration/REQ-427.feature kind=functional status=Implemented -->
