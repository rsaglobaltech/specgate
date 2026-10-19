---
description: Turn the plan or brief into requirements, one module at a time.
argument-hint: <module>
---

# /specgate:draft

Turn the plan or brief into requirements, one module at a time.

**Use when:** The project starts from a plan or brief (`docs/brief.md`), or the user names a module of it to specify.

## Run

```bash
specgate draft $ARGUMENTS
```

## Guidance

- No `docs/brief.md`: show the person what `specgate draft` prints about a brief, and stop — the brief is theirs to write (`specgate draft --new-brief` gives them one to fill in).
- If `specgate draft` says the brief has no front matter, or that it needs fixes: follow `docs/specs/BRIEF-SETUP.md`. Write or fix only the front matter at the top of `docs/brief.md` — never a word below it — run `specgate draft` again, then **stop** and show the front matter to the person to review. Draft no module in the same turn.
- Without a module, `specgate draft` lists the brief's modules and names the next one. Draft that one.
- `specgate draft <module>` opens the draft and writes `DRAFTING.md` inside it. Follow it exactly: it has the reserved ids, the actors and surfaces, and every format the checklist reads.
- Write only inside `docs/specs/changes/draft-<module>/`. Then run `specgate draft <module>` again and fix every finding until it says **Ready to review**.
- A `D6_unlisted_value` is a value the brief never gave: use the brief's value, list it in `assumptions.md`, or make it a question. Never invent a business rule — what only the client can decide goes in `questions.md`.
- Do not archive. End with the open questions for the person: they review the draft and answer what they can. Then each requirement is built test first and delivered with `specgate apply REQ-NNN`; a person runs `specgate archive draft-<module>` once all of them are applied.

> The authoritative rules come from `specgate change instructions <artifact> --json`.
> If this file and the engine disagree, the engine is right — say so and continue.
