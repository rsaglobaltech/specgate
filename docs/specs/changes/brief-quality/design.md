# Design: brief-quality

> Owner: architect — how the system meets the Discover.

## Modules

`packages/core/src/domain/BriefCards.ts` (reading `## Quality` and `## Why`,
rules B14 and B15), `scripts/draft/drafting-guide.ts` and
`scripts/cli/commands/spec/DraftCommand.ts` (the entries handed to a draft),
`scripts/draft/brief-setup.ts` (template, cards guide, explanation).

## Mechanisms

- AC-1 — `readBriefQuality`: the section is `## Quality` (also `## Calidad`,
  `## Quality requirements`, `## Requisitos de calidad`, `## Non-functional
  requirements`, `## Requisitos no funcionales`). Each list item is
  `- <characteristic> (<module>, …): <statement>`; the parenthesis is optional.
  `qualityCharacteristic` maps the nine ISO/IEC 25010:2023 characteristics,
  their 2011 names (usability, portability) and common sub-characteristics
  (availability, accessibility, privacy…) in English and Spanish to the
  canonical name. Rules:
  - `B14_quality_unmeasured` (error): the statement uses a word no test can
    check (`VAGUE`) or promises a quantity with no number (`unmeasured`), the
    same tests as B5 and B6. An error, not a warning: the section exists to
    state the fit criterion.
  - `B14_quality_module` (error): a scope naming no module of `modules:`.
  - `B14_quality_shape` (warning): an item with no `<characteristic>:`.
  - `B14_quality_characteristic` (warning): a characteristic outside ISO/IEC
    25010; the fix lists the nine.
- AC-2 — `B15_why_unmeasured` (warning): a `## Why` (also `## Por qué`,
  `## Goals`, `## Objectives`, `## Objetivos`) with text and no number in it.
  A warning, so a brief written before this change still drafts.
- AC-3 — `qualityFor(brief, module)`: the entries scoped to the module, plus
  the product-wide ones when the module is the first of `modules:` (the first
  built, REQ-600). `ModuleCards.quality` carries them; `DRAFTING.md` section 0
  lists them as non-functional requirements to write, quoted under
  `> Brief:`. Their values are already the brief's for D6, which reads the
  whole brief.
- AC-4 — `BRIEF_TEMPLATE` gains `## Quality` with a commented example per
  common characteristic, and its `## Why` comment asks for the problem, the
  objectives and their numbers. `briefCardsGuide` asks for a `## Quality`
  section when the text says how well the product must work.
  `noBriefExplanation` lists it.
- AC-5 — no section, no finding: neither rule says a section is missing.

## Channels

`propose --from-brief --check` (text and `--json`) shows the new findings, and
the overview and drafting stop on B14's errors as they stop on any brief
error. No new command or flag.

## Decisions

- Product-wide quality goes to the first module's draft, not to every draft:
  one non-functional requirement, not one copy per module.
- A missing `## Quality` is not reported: a note on every existing brief would
  be noise, and the template now teaches it. Issue #485 keeps the required
  tier for a later slice.
