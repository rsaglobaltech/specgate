# Discover: use-cases-lifecycle

## Context

`init` writes docs/specs/use-cases.md and AGENTS.md asks that every flow be a
use case, yet nothing ever filled it or checked it: a project of 134 applied
requirements still had the template's row (#543, found from Specgate Studio).

## Use case

1. A draft from a brief comes with its use cases; each requirement names one.
2. The reviewer approves them with the draft; archive merges them into the catalog.
3. A later change adds, modifies or removes use cases the same way.
4. The gate reports a requirement with no use case, and fails it once the team says so.

## Acceptance criteria

- AC-1: a change's use cases are checked and merged at archive; a removal nobody can make is refused.
- AC-2: a draft names a use case for every requirement before it is ready.
- AC-3: the gate checks the catalog against the matrix, at a level the team sets.
