# Design: rc3-workspace

> Owner: architect — how the system meets the Discover. Name each acceptance
> criterion (AC-1, AC-2…) where it is answered.

## Modules

- AC-1 — `workspace draft --agent` with no story named runs the agent through
  `runConfinedAgent`, allowed to write only `docs/brief.md`, told to fill the
  front matter's `stories:` with `# check:` comments; the client's text below
  the front matter is compared before and after and put back if changed. With
  stories named and none given, `--agent` is refused with the command to run.
- AC-2 — `story.md`'s `## Repositories` section lists each repository with the
  criteria it answers: `` - `fleet`: AC-1, AC-2 ``. `storyCriteria()` reads it;
  the drafting prompt asks for it; `workspace propose` writes in each Discover a
  section `## This repository's part` naming its criteria and the others'.
- AC-3 — `workspace check` warns `workspace_criterion_unanswered` and
  `workspace_criterion_shared` when a story maps its criteria.
- AC-4 — `docs/stories/<id>/questions.md`, a draft's format (D7); the
  drafting prompt writes the questions there; `workspace propose` refuses
  `workspace_story_questions_open`, naming them, unless `--allow-open-questions`.
- AC-5 — after the agent, a section that holds text loses its `<!-- … -->` hint.
- AC-6 — the guidance on `depends=` and `api=` moves from the Discover to the
  sub-change's `design.md` (`## Across repositories`); the Discover keeps the
  repositories' names and roles only.
- AC-7 — `workspace propose` writes `story.json` in each sub-change (the
  workspace's path from the repository, the story, the repository's name);
  `change author` in that change appends the story's context to its prompt, as
  the harness's prompt does.
- AC-8 — `workspace harness run --story` computes, at each level, which of a
  repository's requirements have every `depends=` delivered; only those get
  `--req`; the others are printed as waiting on the named requirements, and the
  run exits 1 when anything waited or failed.
