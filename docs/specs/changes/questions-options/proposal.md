# Proposal: questions-options

## Intent

specgate-studio's phase 2 shows each open question with its options (editor,
Questions, project setup). `specgate questions --json` does not carry them —
specgate reads the "Options seen" cell (REQ-210) and leaves it out of its
answer — so the studio parses `questions.md` itself, a file specgate owns. And
the phase-2 brief's own example, "free above some amount", passes the brief
check: B6 knows quantity words ("fast", "scalable") but not a threshold named
without its value.

## Scope

In scope:

- `options` in every open question of `questions --json` and the API.
- B6 flags a threshold named without its value, in English, Spanish and German.

Out of scope:

- Writing options (`specgate ask` keeps its current form).

## Approach

The options are already parsed (`QuestionRow.options`); the document maps
them. B6 gains a second pattern next to the quantity words. Approved with the
person who leads specgate-studio, 2026-11-10.
