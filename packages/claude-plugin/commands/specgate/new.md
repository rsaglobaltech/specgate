---
description: Add a requirement: its prose, its scenario and its row, in one step.
---

# /specgate:new

Add a requirement: its prose, its scenario and its row, in one step.

**Use when:** The user asks for a behaviour that no requirement covers yet.

## Run

```bash
specgate new "<what the system must do>" --json
```

## Guidance

- It writes a draft `## REQ-NNN` section in `spec.md` and a scenario of `<placeholder>` steps under `features/`.
- Rewrite the obligation and the placeholders with the user before implementing — they are questions, not answers. The gate refuses them on delivery.
- Do not edit the matrix: it is generated.

> The authoritative rules come from `specgate change instructions <artifact> --json`.
> If this file and the engine disagree, the engine is right — say so and continue.
