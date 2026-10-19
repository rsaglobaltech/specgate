---
description: Open a change: the requirements to add or modify, as a reviewable delta.
---

# /specgate:propose

Open a change: the requirements to add or modify, as a reviewable delta.

**Use when:** The user asks for a behaviour no requirement covers, or for a change to one that shipped.

## Run

```bash
specgate propose <change-id>
specgate change instructions proposal --json
specgate change instructions specs --json
```

## Guidance

- `change instructions` returns the template, the rules the validator enforces, and the project's declared stack. Follow it rather than guessing the format.
- A delta states only what changes. It is not a copy of the spec. Until it is archived, its requirements are in flight: `status`, `check` and `apply` read them from the delta.
- Every requirement body needs SHALL / MUST / SHOULD / MAY, and every scenario needs plain `- GIVEN` / `- WHEN` / `- THEN` bullets.
- Do not archive yet. Next: a test for each requirement, then `/specgate:apply`.

> The authoritative rules come from `specgate change instructions <artifact> --json`.
> If this file and the engine disagree, the engine is right — say so and continue.
