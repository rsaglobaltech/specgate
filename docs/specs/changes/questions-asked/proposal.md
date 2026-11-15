# Proposal: questions-asked

## Intent

specgate-studio's Questions view (phase 2, draft-questions REQ-091…093) shows
every open question with where it was asked — the brief, a draft, or the agent
while it builds — and keeps an answered question in sight, waiting for "The
spec says it" (`specgate answer <Q> --reviewed`). `specgate questions --json`
says neither: it does not say where a question was asked, and an answered
question leaves its answer at once, before anyone confirms the spec says it.
The studio would have to parse `questions.md` itself, a file specgate owns.

## Scope

In scope:

- `asked` in every question of `questions --json` and the API: `brief`,
  `draft` or `build`.
- `specgate ask` records that its question was asked while building.
- `answered` in `questions --json` and the API: the questions answered and not
  yet confirmed, each with its answer.

Out of scope:

- Changing how an answer is written or confirmed (`answer`, `answer --reviewed`).
- Telling apart, in a project written before this change, a question `ask`
  added from one a draft wrote: without the record it reads as the draft's.

## Approach

`ask` writes `build` in an `Asked` column of the question's row, adding the
column when the table has none (as `answer` adds `Answer` and `Status`). A
question of a change opened from a brief whose text is one of the questions
of the brief's module reads as `brief`. Approved with the person who leads
specgate-studio, 2026-11-11.
