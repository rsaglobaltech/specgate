# Traceability Matrix — {{PROJECT_NAME}}

Every requirement in `spec.md` maps to a scenario, its feature file, and the
artifacts that implement and verify it. `specgate plan` lists
what is still missing; `specgate apply REQ-NNN` flips a row to
Implemented.

| Requirement | Scenario ID | Feature file | Use Case | Command/Query | Aggregate | Event | Technical artifact | Test artifact | Status |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| REQ-001 | SCN-001 | `features/adoption/baseline.feature` | UC-001 Preserve existing behaviour | - | - | - | existing codebase | `{{TEST_CMD}}` | Draft |
{{PROPOSED_ROWS}}