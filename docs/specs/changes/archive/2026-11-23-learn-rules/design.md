# Design: learn-rules

> Owner: architect — how the system meets the Discover. Name each acceptance
> criterion (AC-1, AC-2…) where it is answered.

## Modules

- `packages/core/src/domain/Lessons.ts` (new) — the lessons, pure.
- `scripts/cli/commands/project/LearnCommand.ts` (new) — `specgate learn`.
- `scripts/lib/change-review.ts` — the approval writes the principle.

## Mechanisms

- AC-1 — review notes: every note of every change's review.md, open, archived
  included; two notes are alike when they share at least 60 % of their
  significant words (four letters or more, lower case, accents folded); a
  group of alike notes from two changes or more is a lesson `review`. Harness:
  `.harness/events/*.jsonl` `gate` events with `result: fail`; a stage failed
  in three attempts or more, over two requirements or more, is a lesson
  `harness`. Each lesson: `L1`, `L2`… in order of count, its evidence, and
  `specgate learn promote L1 --title "<rule>"`.
- AC-2 — `specgate learn promote <L> --title <t> [--forbid <re> --in <glob> |
  --run <cmd>] [--level warn]` opens the change `learn-<slug of the title>`
  (`skip_specs: true`, `learn_principle:` its fields as one JSON line), its
  Discover the lesson's evidence. Approving its layers appends `## P<n> —
  <title>` (and the `specgate:principle` comment for a barrier) to
  `docs/specs/principles.md`, creating it with `principles_version: 1.0.0`.

## Channels

None: files and the CLI. The studio adds "Turn into a rule" on a review note
(a studio change).

## Decisions

A rule is never written without a person: learn proposes, a change carries it.
