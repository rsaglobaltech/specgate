---
description: Old name of `/specgate:apply`: deliver one requirement through the gate.
---

# /specgate:done

Old name of `/specgate:apply`: deliver one requirement through the gate.

**Use when:** Only when a script or a person asks for `done` — otherwise use `/specgate:apply`.

## Run

```bash
specgate apply <REQ-NNN> --json
```

## Guidance

- Same command as `/specgate:apply`: the test first, named after the requirement, then `specgate apply`.
- The status is written into `spec.md` or the open change; the matrix is regenerated from it.

> The authoritative rules come from `specgate change instructions <artifact> --json`.
> If this file and the engine disagree, the engine is right — say so and continue.
