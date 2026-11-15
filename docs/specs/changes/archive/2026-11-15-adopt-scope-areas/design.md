# Design: adopt-scope-areas

> Owner: architect — how the system meets the Discover. Name each acceptance
> criterion (AC-1, AC-2…) where it is answered.

## Modules

`adopt` (AdoptCommand) and the area reading in OnboardCommand.

## Mechanisms

- AC-1 — `capabilitiesUnder` reads the areas under the scope; they go to
  `docs/specs/adoption.md` as every adoption's areas do (REQ-471).
- AC-2 — the scope line in spec.md and the baseline feature's name, unchanged.
- AC-3 — the missing-path check before any write, unchanged.

## Channels

None.

## Decisions

ADR-0041 (adoption reads areas, proposes no requirement) wins over the 1.0
line's wording of REQ-337; the behaviour is the merged code's.
