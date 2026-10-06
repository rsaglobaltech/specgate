---
description: Implement the change: tests first, then code.
---

# /specgate:apply

Implement the change: tests first, then code.

**Use when:** The change is validated and its proposal is agreed.

## Run

```bash
specgate change instructions apply --json
specgate plan --json
```

## Guidance

- One requirement at a time. `specgate plan` is the queue.
- Write the test first. Set the row's status to `In Dev` only once it exists, or `validate --strict` fails with `[TDD-1]`.
- Never edit `docs/specs/traceability.md` by hand — `specgate req link` and `specgate done` write it.

> The authoritative rules come from `specgate change instructions <artifact> --json`.
> If this file and the engine disagree, the engine is right — say so and continue.
