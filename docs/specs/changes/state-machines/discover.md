# Discover: state-machines

## Context

The Reviewer approved, from VP-style mocks, a state machine per entity drawn in the studio; specgate kept no domain states (status-model.md is the process's statuses).

## Acceptance criteria

- AC-1: a machine per entity, checked by the gate against the requirements.
- AC-2: changed only through a change's delta, refused when it breaks the machine.
- AC-3: PlantUML beside it, in status --json, asked for by the drafting guide and checked in a draft.
