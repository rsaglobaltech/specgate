---
description: Close a requirement through the gate.
---

# /specgate:done

Close a requirement through the gate.

**Use when:** Its scenario is real, its test names it and `check` is green.

## Run

```bash
specgate done <REQ-NNN> --strict --json
```

## Guidance

- `--strict` runs the whole gate for this requirement before recording anything; a refusal changes nothing.
- The status is written into `spec.md`; the matrix is regenerated from it.

> The authoritative rules come from `specgate change instructions <artifact> --json`.
> If this file and the engine disagree, the engine is right — say so and continue.
