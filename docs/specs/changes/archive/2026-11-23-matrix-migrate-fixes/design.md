# Design: matrix-migrate-fixes

> Owner: architect — how the system meets the Discover. Name each acceptance
> criterion (AC-1, AC-2…) where it is answered.

## Modules

- `packages/core/src/infrastructure/DerivedMatrixSources.ts` — which files are tests.
- `scripts/cli/commands/spec/MatrixCommand.ts` — `planMigration`.

## Mechanisms

- AC-1 — `isTestFile`: `spec` and `specs` count as a test folder only as the
  first segment of the path (RSpec's `spec/`); `test`, `tests`, `__tests__`,
  `e2e` and the rest keep counting anywhere. A file named as a test
  (`*_spec.rb`, `*.spec.ts`) is a test wherever it is.
- AC-2 — `planMigration` skips every requirement stated in a capability spec
  (the derivation reads it there) or added by an open change (`inFlightRequirements`
  not in spec.md nor a capability spec): no section is appended for it. The
  rows of the latter are left out of the comparison, and `--migrate` reports
  them (`matrix_rows_in_changes`, info) with the changes that own them.

- AC-3 — `diffRowsKept` in `DerivedMatrix.ts`: identity columns compared as
  before; code and test columns kept when the generated list holds every file
  of the hand-kept one. `--migrate` reports them as `matrix_rows_richer`.
  `matrix --check` keeps the strict `diffRows`.

## Channels

None.

## Decisions

The matrix is the archived truth (ADR-0035): a requirement still in a change
is read by `status` and `apply` through the change, not through the matrix.
