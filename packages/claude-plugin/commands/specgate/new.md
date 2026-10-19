---
description: Add one requirement straight to `spec.md`: its prose, its scenario and its row.
---

# /specgate:new

Add one requirement straight to `spec.md`: its prose, its scenario and its row.

**Use when:** A small project without changes, or the user asks for a single requirement outside a change.

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
