---
description: Merge an accepted change into the spec tree.
---

# /specgate:archive

Merge an accepted change into the spec tree.

**Use when:** The change is implemented and every task is checked.

## Run

```bash
specgate change instructions archive --json
specgate change archive <change-id> --dry-run
specgate change archive <change-id> --json
```

## Guidance

- Preview with `--dry-run` first: it lists the specs that will move.
- Archiving writes the specs and materialises the feature files; the matrix follows on its own.

> The authoritative rules come from `specgate change instructions <artifact> --json`.
> If this file and the engine disagree, the engine is right — say so and continue.
