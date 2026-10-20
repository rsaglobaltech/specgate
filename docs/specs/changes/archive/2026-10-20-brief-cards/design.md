# Design: brief-cards

## Technical approach

A pure module in core, `BriefCards`, parses the brief's body — the `##`
sections, and in each `## Module: <name>` the `Rules`, `Examples` and
`Questions` lists — and runs rules B2 to B11 over it. The front matter's own
checks (B1) stay in `scripts/draft/brief-setup.ts`, which already holds them.
`scripts/draft/brief-check.ts` joins the two into diagnostics for the CLI.

`DraftCommand` runs the rules in three places: `--check` (report only), the
overview (errors stop it, as front-matter problems did), and before opening a
draft (errors refuse it). `DRAFTING.md` takes the module's section when there
is one.

## Decisions

### Decision: cards, not user stories

Rules, examples and questions map one-to-one onto requirement, scenario and
`questions.md` row; user stories would add a fourth shape to translate.

### Decision: errors only where a draft would be wrong

Shapes, an empty brief, a module without a section or without rules and
examples stop the draft. Everything about wording — vague words, unmeasured
promises, technology, size, EARS — warns: a person decides.

### Decision: briefs without sections keep working

A pasted email is still a brief. Without module sections the agent reads the
whole text, as before, and the check says once how to sharpen it.

## Affected files

- `packages/core/src/domain/BriefCards.ts` (new), `DraftChecklist.ts` (D6)
- `scripts/draft/brief-setup.ts`, `brief-check.ts` (new), `drafting-guide.ts`
- `scripts/cli/commands/spec/DraftCommand.ts`, `ExploreCommand.ts`
- `docs/start/write-the-brief.md`, `docs/start/scratch-2-specify.md`,
  `scripts/docs/journey-storyboard.ts`, `scripts/docs/record-journey.ts`
