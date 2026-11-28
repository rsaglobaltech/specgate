# Design: evidence-html

> Owner: architect — how the system meets the Discover. Name each acceptance
> criterion (AC-1, AC-2…) where it is answered.

## Modules

`scripts/lib/evidence-page.ts` (the evidence gathered into a model, rendered as Markdown), new `scripts/lib/evidence-html.ts`, `EvidenceCommand.ts`, docs, tests.

## Mechanisms

AC-1 — `changeEvidence` gathers each requirement once; `writeEvidencePage` renders the Markdown from it, as before, and `writeEvidenceHtml` renders `EVIDENCE.html` beside it on `--html`: the screens as data URIs up to 2 MB each, the scenarios, calls and AI decisions as tables, each sequence at the base and now side by side, the classes with their base folded, light and dark. Mermaid loads from a pinned jsDelivr build; without a network the diagrams' text shows.

AC-2 — `--open` writes it and opens it with the platform's opener, detached; not when `CI` or `SPECGATE_NO_OPEN` is set.

## Decisions

Mermaid from a CDN, not bundled: Specgate has no runtime dependency, and the library is several megabytes. A generator of HTML from the Markdown was rejected: the model is the source, both pages its renderings.
