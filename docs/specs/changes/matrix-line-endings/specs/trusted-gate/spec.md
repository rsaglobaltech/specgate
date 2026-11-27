# Delta — trusted-gate

## ADDED Requirements

### Requirement: REQ-808 — A matrix checked out with CRLF is current

<!-- specgate:trace actor=Developer kind=functional -->

The system SHALL treat `docs/specs/traceability.md` as current when it differs from the matrix Specgate would generate only in its line endings (`\r\n` for `\n`), in `validate` and wherever the matrix is compared, without rewriting it; and SHALL still report `matrix_stale` when any other character differs.

> Reported on 2026-11-27: a fresh Windows worktree (`core.autocrlf=true`) failed `validate` with a current matrix.

#### Scenario: SCN-808a — CRLF, same rows

- GIVEN a project whose generated matrix is current, rewritten with CRLF line endings
- WHEN the Developer runs `specgate validate`
- THEN no `matrix_stale` is reported

#### Scenario: SCN-808b — CRLF, a row changed

- GIVEN the same matrix with CRLF line endings and one row's status changed
- WHEN the Developer runs `specgate validate`
- THEN `matrix_stale` is reported
