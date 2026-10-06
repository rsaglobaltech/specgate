---
description: Check the change before anyone reviews it.
---

# /specgate:verify

Check the change before anyone reviews it.

**Use when:** After writing or editing any artefact of a change.

## Run

```bash
specgate change validate --json
specgate validate . --json
```

## Guidance

- Every diagnostic carries a `fix`. Apply it rather than guessing.
- Branch on `code`, never on `message` — the message is prose and may be reworded.
- `specgate validate` validates active changes too, so this is also the PR gate.

> The authoritative rules come from `specgate change instructions <artifact> --json`.
> If this file and the engine disagree, the engine is right — say so and continue.
