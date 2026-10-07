---
description: See what is left, and the one command to run next.
---

# /specgate:explore

See what is left, and the one command to run next.

**Use when:** Starting work, or unsure what to do next.

## Run

```bash
specgate status --json
```

## Guidance

- Read `spec.md` and `AI_RULES.md` first — `AI_RULES.md` is binding, not advisory.
- `requirements` lists each one with what it still needs; `nextCommand` names the step.
- Do not start on a requirement until you can say which `REQ-NNN` it is.

> The authoritative rules come from `specgate change instructions <artifact> --json`.
> If this file and the engine disagree, the engine is right — say so and continue.
