# Design: matrix-line-endings

> Owner: architect — how the system meets the Discover. Name each acceptance
> criterion (AC-1, AC-2…) where it is answered.

## Modules

`scripts/cli/commands/spec/MatrixCommand.ts`, `scripts/cli/commands/quality/ValidateSpecsCommand.ts`, `scripts/harness/run/worktree-checks.ts`, and their tests.

## Mechanisms

AC-1 — `sameMatrix(a, b)` in MatrixCommand compares the two with every `\r\n` read as `\n`. `validate`, the worktree check and `refreshDerivedMatrix` use it, so a CRLF checkout is neither stale nor rewritten.

AC-2 — only line endings are ignored; any other byte still differs.

## Decisions

Writing the matrix with CRLF on Windows was rejected: git decides what a checkout holds, and the file in the repository stays LF.
