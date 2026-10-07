---
description: Install spec-driven development on a repository that lacks it.
---

# /specgate:onboard

Install spec-driven development on a repository that lacks it.

**Use when:** The repository has code but no `spec.md`.

## Run

```bash
specgate init
specgate check --json
```

## Guidance

- `specgate init` adopts a repository that has code: it never overwrites a file and never touches source.
- Then add real requirements one at a time with `specgate new`, starting with what the team is changing now.

> The authoritative rules come from `specgate change instructions <artifact> --json`.
> If this file and the engine disagree, the engine is right — say so and continue.
