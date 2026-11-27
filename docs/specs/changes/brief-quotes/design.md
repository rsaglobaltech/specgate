# Design: brief-quotes

> Owner: architect — how the system meets the Discover. Name each acceptance
> criterion (AC-1, AC-2…) where it is answered.

## Modules

`packages/core/src/domain/DraftChecklist.ts`, `scripts/cli/commands/spec/DraftCommand.ts` (the checklist in its usage), and their tests.

## Mechanisms

AC-1 — `checkDraft`, beside D6, reads each `> Brief:` line of a requirement's text and reports `D17_quote_not_in_brief` at its line when the quote is not in the brief with its comments taken out.

AC-2 — both sides are compared lowercased, with quote marks and `*`/`_` removed and runs of space made one; the quote also loses its closing `.`, `;`, `:`, `!` or `?`. `brief add` writes a brief's `"` as `'`, so neither counts.

## Decisions

Only that the quote exists. Whether the requirement says what the quote says is a judgement for a person or an agent's review, not for a deterministic gate.
