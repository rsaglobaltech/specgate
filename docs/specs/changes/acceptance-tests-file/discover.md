# Discover: acceptance-tests-file

> Owner: product — what the business needs and why. No technology here: the
> design says how.

## Context

Two features of Specgate write the same file. `specgate acceptance <change>`
writes the business sign-off checklist to a change's `acceptance.md`; the
sealed acceptance tests of 2026-11-26 read the same `acceptance.md` as the
list of tests to seal. A team that uses both loses one to the other: the
checklist is read as a list of tests, or a list of tests is overwritten by a
checklist.

## Use case

1. A business reviewer signs off a change with `specgate acceptance`, as before.
2. The tests a person approves for the same change are listed in a file of
   their own, and sealed from it.
3. Neither ever reads or writes the other's file.

## Acceptance criteria

- AC-1: the sealed acceptance tests are listed in `acceptance-tests.md`; `acceptance.md` stays the sign-off checklist, and each command reads and writes only its own file.
