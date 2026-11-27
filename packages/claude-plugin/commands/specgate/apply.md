---
description: Deliver one requirement: the test first, then the code, then the gate.
---

# /specgate:apply

Deliver one requirement: the test first, then the code, then the gate.

**Use when:** A requirement — in `spec.md` or in an open change — has a real scenario and no implementation yet.

## Run

```bash
specgate status --json
specgate change instructions apply --json
specgate apply <REQ-NNN> --json
```

## Guidance

- One requirement at a time — `status` is the queue.
- Write the test first and **name the requirement in it** (`REQ-007` in the test's name; a comment counts only while `.specgate/gate.yaml` does not say `link: strict`). That mention is the link: no `req link`, no matrix edit.
- With `bdd: required`, once the test is written and before the code, run `specgate evidence before REQ-NNN`: what the flow did before the change, kept beside what `apply` keeps after.
- Mention the requirement in the code that implements it too, so its row points at the code.
- Never change `spec.md`, a delta or a `.feature` to make a test pass.
- `specgate apply` refuses a requirement no test names and runs the gate; a refusal changes nothing. Green, it records Implemented.

> The authoritative rules come from `specgate change instructions <artifact> --json`.
> If this file and the engine disagree, the engine is right — say so and continue.
