---
description: Implement one requirement: the test first, then the code.
---

# /specgate:apply

Implement one requirement: the test first, then the code.

**Use when:** A requirement has a real scenario and no implementation yet.

## Run

```bash
specgate status --json
specgate change instructions apply --json
```

## Guidance

- One requirement at a time — `status` is the queue.
- Write the test first and **name the requirement in it** (`REQ-007` in a comment or the test name). That mention is the link: no `req link`, no matrix edit.
- Mention the requirement in the code that implements it too, so its row points at the code.
- Never change `spec.md` or a `.feature` to make a test pass.

> The authoritative rules come from `specgate change instructions <artifact> --json`.
> If this file and the engine disagree, the engine is right — say so and continue.
