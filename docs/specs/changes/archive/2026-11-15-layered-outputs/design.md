# Design: layered-outputs

> Owner: architect — how the system meets the Discover. Name each acceptance
> criterion (AC-1, AC-2…) where it is answered.

## Modules

`ReleaseNotes.intentOf`, `ReviewPage`, `Acceptance`, and the `review`,
`acceptance`, `release-notes` and `reverse` commands.

## Mechanisms

- AC-1 — `review` reads `discover.md`, else `proposal.md`; the page gains an
  "Acceptance criteria" section from `acceptanceCriteria`. One `intentOf`.
- AC-2 — `renderAcceptance` lists each criterion before the scenarios.
- AC-3 — `intentOf` reads `## Context` or `## Intent`, skipping a template's hint.
- AC-4 — `reverse` writes `discover.md`, `design.md`, a task per requirement,
  and `schema: layered`.

## Channels

None.

## Decisions

ADR-0044: every change is layered; a 0.x change's proposal still reads.
