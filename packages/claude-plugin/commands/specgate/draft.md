---
description: Turn the plan or brief into requirements, one module at a time.
argument-hint: <module>
---

# /specgate:draft

Turn the plan or brief into requirements, one module at a time.

**Use when:** The project starts from a plan or brief (`docs/brief.md`), or the user names a module of it to specify.

## Run

```bash
specgate propose --from-brief $ARGUMENTS
```

## Guidance

- No `docs/brief.md`: show the person what `specgate propose --from-brief` prints about a brief, and stop — the brief is theirs to write (`specgate propose --from-brief --new-brief` gives them one to fill in).
- If `specgate propose --from-brief` says the brief has no front matter, or that it needs fixes: follow `docs/specs/BRIEF-SETUP.md`. Write or fix only the front matter at the top of `docs/brief.md` — never a word below it — run `specgate propose --from-brief` again, then **stop** and show the front matter to the person to review. Draft no module in the same turn.
- If the front matter is complete and the brief has no `## Module:` sections: follow `docs/specs/BRIEF-CARDS.md`. Add one section per module — Rules, Examples, Questions — from the brief's own text, keep every line already there, then **stop** and show the sections to the person.
- Before a module is drafted, `specgate propose --from-brief --check` must report no error: it checks the brief's fields, a section per module, and rules with examples. Its warnings are for the person to judge.
- Without a module, `specgate propose --from-brief` lists the brief's modules and names the next one. Draft that one.
- `specgate propose --from-brief <module>` opens the draft and writes `DRAFTING.md` inside it. Follow it exactly: it has the module's section of the brief, the values to use, the reserved ids, the actors and surfaces, and every format the checklist reads.
- Write only inside `docs/specs/changes/draft-<module>/`. Then run `specgate propose --from-brief <module>` again and fix every finding until it says **Ready to review**.
- A `D6_unlisted_value` is a value the brief never gave: use the brief's value, list it in `assumptions.md`, or make it a question. Never invent a business rule — what only the client can decide goes in `questions.md`.
- Do not archive. End with the open questions for the person: they review the draft and answer what they can. Then each requirement is built test first and delivered with `specgate apply REQ-NNN`; a person runs `specgate archive draft-<module>` once all of them are applied.

> The authoritative rules come from `specgate change instructions <artifact> --json`.
> If this file and the engine disagree, the engine is right — say so and continue.
