# Design: brief-from-workshop

- AC-1 — `packages/core/src/domain/DddBoards.ts` (pure, ported from the studio's spike, same author): `storyOf`, `eventStormingOf`, `canvasOf`, `domainModelOf`, `modelYamlOf`. `scripts/draft/workshop-import.ts` writes the models and merges the brief: front matter `modules` and `actors` (persons on web, systems on api) extended, a `## Module: <context>` card appended (Rules, Questions, Model). `specgate brief import` in `scripts/brief_import.ts`, listed under `brief` in the surface.
- AC-2 — `draftingGuide` gets `model?: string`; `checkDraftChange` reads `docs/brief/models/*.yaml` with the brief for D6.
- AC-3 — `propose --from-model` in `scripts/propose.ts`: import, then `DraftCommand` on the first module added.
- AC-4 — only the files' records are read, by their shape; fixtures are boards made on dddtoolbox.com with its own editor.
