---
description: Merge the change into the spec tree.
---

# /specgate:archive

Merge the change into the spec tree.

**Use when:** The work is done and every task is checked.

## Run

```bash
specgate change instructions archive --json
specgate change archive <change-id> --dry-run
specgate change archive <change-id> --json
```

## Guidance

- Preview with `--dry-run` first: it lists the specs and matrix rows that will move.
- Archiving inserts the traceability rows and materialises the feature files. It is not a file move.
- After archiving, `specgate plan` lists the requirement as pending work.

> The authoritative rules come from `specgate change instructions <artifact> --json`.
> If this file and the engine disagree, the engine is right — say so and continue.
