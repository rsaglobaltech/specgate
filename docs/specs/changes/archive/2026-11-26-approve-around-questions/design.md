# Design: approve-around-questions

> Owner: architect — how the system meets the Discover. Name each acceptance
> criterion (AC-1, AC-2…) where it is answered.

## Modules

`scripts/lib/change-review.ts` (`approvalBlockers`), its tests, and the getting-started pages and their recording (`docs/start/`, `scripts/docs/journey-storyboard.ts`, `scripts/docs/record-terminal.ts`). No other source file changes.

## Mechanisms

AC-1 — `approvalBlockers` reads the trace status of each requirement in the change's deltas. An open question whose `Blocks` names only requirements in Needs Clarification is not a blocker; the draft checklist's errors that name only such requirements are not either. Any other open question blocks as before (`approve_question_open`).

AC-2 — unchanged behaviour, relied on: `apply` refuses a Needs Clarification requirement (`done_needs_clarification`), the harness skips it, and approving seals each requirement's statement and scenarios, so writing it out after the answer fails the gate with `approved_requirement_changed` until a person approves again.

## Decisions

The question still shows in `status` and in `change show`; only approval stops waiting for it.
