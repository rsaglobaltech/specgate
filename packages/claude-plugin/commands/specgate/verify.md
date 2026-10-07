---
description: Run the gate: specs, links, coverage and the project's tests.
---

# /specgate:verify

Run the gate: specs, links, coverage and the project's tests.

**Use when:** After every change, and before saying the work is done.

## Run

```bash
specgate check --json
```

## Guidance

- Every diagnostic carries a `fix`. Apply it rather than guessing.
- Branch on `code`, never on `message` — the message is prose and may be reworded.
- `tests_not_configured` means nothing executed the suite: say so, do not report success.

> The authoritative rules come from `specgate change instructions <artifact> --json`.
> If this file and the engine disagree, the engine is right — say so and continue.
