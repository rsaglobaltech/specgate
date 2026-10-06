---
description: Open a change and write its proposal and delta.
---

# /specgate:propose

Open a change and write its proposal and delta.

**Use when:** A requirement needs adding, rewording or retiring.

## Run

```bash
specgate change new <change-id>
specgate change instructions proposal --json
specgate change instructions specs --json
```

## Guidance

- `change instructions` returns the template, the rules the validator enforces, and the project's declared stack. Follow it rather than guessing the format.
- A delta states only what changes. It is not a copy of the spec.
- Every requirement body needs SHALL / MUST / SHOULD / MAY, and every scenario needs plain `- GIVEN` / `- WHEN` / `- THEN` bullets.

> The authoritative rules come from `specgate change instructions <artifact> --json`.
> If this file and the engine disagree, the engine is right — say so and continue.
