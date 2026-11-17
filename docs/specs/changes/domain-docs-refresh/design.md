# Design: domain-docs-refresh

> Owner: architect — how the system meets the Discover. Name each acceptance
> criterion (AC-1, AC-2…) where it is answered.

## Modules

`scripts/lib/domain-docs.ts`, `scripts/cli/commands/quality/CheckCommand.ts`,
`scripts/cli/commands/change/ChangeCommand.ts` (archive), `scripts/glossary.ts`,
`packages/core/src/domain/Glossary.ts`.

## Mechanisms

- AC-1 — `projectActors`: the brief's actors, else the distinct `actor=` of the
  delivered requirements (first spelling wins, case ignored). `archive`
  regenerates the model and the actors after writing the specs, as `check` does.
- AC-2 — `actorsNotDrawn`: `check` prints why, when `actors.md` exists and no
  actor is named anywhere.
- AC-3 — `specgate glossary [--write] [--json]`: `suggestTerms` over the actors
  and the domain model's entities, minus the glossary's terms; `withTerms` adds
  rows under the table, Definition and Avoid empty.

## Channels

A new command, `specgate glossary` (`glossary` in JSON): a minor release.

## Decisions

The command suggests names; it never writes a definition or an Avoid list —
the words a team agrees on are theirs.
