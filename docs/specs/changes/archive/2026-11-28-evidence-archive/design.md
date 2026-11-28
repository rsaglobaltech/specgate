# Design: evidence-archive

> Owner: architect — how the system meets the Discover. Name each acceptance
> criterion (AC-1, AC-2…) where it is answered.

## Modules

`scripts/cli/commands/change/ChangeCommand.ts` (archive), `scripts/lib/gate-policy.ts`, `scripts/lib/evidence-page.ts`, `scripts/cli/commands/spec/EvidenceCommand.ts`, docs, and their tests.

## Mechanisms

AC-1 — when the gate policy has `bdd: required` or `evidence: required`, `archive` calls `writeEvidencePage` after its plan is made and before it moves the change, so `EVIDENCE.md` and its copied pictures move into the archive. A page that cannot be written is a warning: the archive goes on.

AC-2 — the requirements of the change with no `before/run.json` are `archive_no_before`: a warning; an error under `evidence: required`, which `--force` passes.

AC-3 — `specgate evidence <change> --base <ref>` passes the ref to the diagrams; without it, the base `check --affected` uses.

## Decisions

Regenerating at archive instead of checking a stamp: the page is output, like the matrix; writing it costs nothing and is never stale. Refusing by default was rejected: a project that adopts the before mid-change would be stuck with requirements it cannot take one for.
