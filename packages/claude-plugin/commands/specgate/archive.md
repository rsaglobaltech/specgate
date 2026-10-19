---
description: Merge a change into the spec tree once every requirement in it is applied.
---

# /specgate:archive

Merge a change into the spec tree once every requirement in it is applied.

**Use when:** Every requirement the change adds or modifies is Implemented, and the person reviewing it says merge.

## Run

```bash
specgate change instructions archive --json
specgate archive <change-id> --dry-run
specgate archive <change-id> --json
```

## Guidance

- A person runs archive: review is the change's pull request. Never archive a change you have not been told to.
- Archive refuses while a requirement of the change is not applied; the fix it prints names the `specgate apply` to run.
- Preview with `--dry-run` first: it lists the specs that will move.
- Archiving writes the specs and materialises the feature files; the matrix follows on its own.

> The authoritative rules come from `specgate change instructions <artifact> --json`.
> If this file and the engine disagree, the engine is right — say so and continue.
