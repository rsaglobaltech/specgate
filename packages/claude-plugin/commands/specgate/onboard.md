---
description: Install spec-driven development on a repository that lacks it.
---

# /specgate:onboard

Install spec-driven development on a repository that lacks it.

**Use when:** The repository has code but no `spec.md`.

## Run

```bash
specgate adopt
specgate doctor --json
specgate validate . --json
```

## Guidance

- `specgate adopt` never overwrites a file and never touches source code.
- Retro-fill real requirements one at a time; a baseline REQ-001 anchors the matrix until then.
- `specgate doctor` reports a concrete fix per finding — work through them before adding the CI gate.

> The authoritative rules come from `specgate change instructions <artifact> --json`.
> If this file and the engine disagree, the engine is right — say so and continue.
