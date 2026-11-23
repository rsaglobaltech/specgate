# Delta — trusted-gate

## ADDED Requirements

### Requirement: REQ-675 — Code under a folder named spec is not a test

<!-- specgate:trace status=Implemented feature=features/trusted-gate/REQ-675.feature actor=Developer kind=functional -->

The system SHALL, when it derives the matrix, read a file as a test only when its name is a test's, or when it sits under a test folder — `spec` or `specs` counting as one only as the first folder of its path — so that source code in a folder named `spec` deeper in the tree, that mentions a requirement, fills the code column and never the test column.

> Found migrating specgate's own matrix (2026-11-23): `scripts/cli/commands/spec/DoneCommand.ts` was listed as the test of REQ-662.

#### Scenario: SCN-675a — A command folder named spec

- GIVEN a project whose `scripts/commands/spec/Done.ts` and `tests/done.test.ts` both mention REQ-062
- WHEN the Developer runs `specgate matrix --json`
- THEN REQ-062's tests are `tests/done.test.ts` only, and its code names `scripts/commands/spec/Done.ts`

#### Scenario: SCN-675b — RSpec's spec folder

- GIVEN a Ruby project whose `spec/models/order_spec.rb` and `spec/support/order_helper.rb` mention REQ-063
- WHEN the Developer runs `specgate matrix --json`
- THEN REQ-063's tests are both files

### Requirement: REQ-676 — The migration leaves an open change's requirements to it

<!-- specgate:trace status=Implemented feature=features/trusted-gate/REQ-676.feature actor=Developer kind=functional -->

The system SHALL, on `specgate matrix --migrate`, never write into `spec.md` a section for a requirement stated in a capability spec or added by an open change; SHALL compare the generated matrix with the hand-kept one without the rows of requirements an open change adds or modifies, which take their place in the matrix when their change is archived; and SHALL report those rows as `matrix_rows_in_changes`, naming each change.

> Found migrating specgate's own matrix (2026-11-23): REQ-660…666, in the open change bdd-gate, were about to be appended to spec.md without their feature files.

#### Scenario: SCN-676a — A requirement still in its change

- GIVEN a hand-kept matrix with a row for REQ-020, stated in spec.md, and one for REQ-021, added by the open change draft-pedidos
- WHEN the Developer runs `specgate matrix --migrate`
- THEN the migration succeeds, spec.md has no section for REQ-021, and the output names draft-pedidos with `matrix_rows_in_changes`

#### Scenario: SCN-676b — A requirement an open change modifies

- GIVEN a hand-kept matrix whose REQ-030 row lists the scenario SCN-030b that the open change draft-avisos adds to REQ-030, stated in a capability spec
- WHEN the Developer runs `specgate matrix --migrate`
- THEN the migration succeeds, REQ-030's row is the capability spec's, and the output names draft-avisos with `matrix_rows_in_changes`

### Requirement: REQ-677 — A row the generated matrix fills in further is kept

<!-- specgate:trace status=Implemented feature=features/trusted-gate/REQ-677.feature actor=Developer kind=functional -->

The system SHALL, on `specgate matrix --migrate`, count a hand-kept row as kept when the generated row has the same requirement, scenario, feature, use case, command, aggregate, event and status, and names every code file and test the hand-kept row names — more allowed, since the generated matrix finds every file that mentions the requirement; SHALL write into the requirement's trace only the code or tests the generated matrix would miss, leaving the rest to be found by mention; and SHALL report those rows as `matrix_rows_richer` so the Developer reviews them before committing.

> Found migrating specgate's own matrix (2026-11-23): 291 of its rows differed only because the generated matrix named more code and tests than the hand-kept one ever listed.

#### Scenario: SCN-677a — More code than the hand-kept row listed

- GIVEN a hand-kept matrix whose REQ-020 row names no code, and `src/orders.ts` mentioning REQ-020
- WHEN the Developer runs `specgate matrix --migrate`
- THEN the migration succeeds, REQ-020's row names `src/orders.ts`, and the output reports one row with `matrix_rows_richer`

#### Scenario: SCN-677b — A test the hand-kept row named and no file mentions

- GIVEN a hand-kept matrix whose REQ-020 row names `tests/orders.test.ts`, and no file mentioning REQ-020
- WHEN the Developer runs `specgate matrix --migrate`
- THEN REQ-020's section in spec.md says `test=tests/orders.test.ts` in its trace, and its row still names it
