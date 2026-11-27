# Design: evidence-before-after

> Owner: architect — how the system meets the Discover. Name each acceptance
> criterion (AC-1, AC-2…) where it is answered.

## Modules

- `scripts/lib/evidence.ts` — the before and after folders, and reading the old layout.
- `scripts/cli/commands/change/ChangeCommand.ts` — the seal-time run (REQ-794) kept as the before.
- `scripts/cli/commands/spec/ReproduceCommand.ts` — the red run of a bug (REQ-682) kept as the before too.
- `scripts/cli/commands/spec/EvidenceCommand.ts` (new) — `specgate evidence before <REQ>` and `specgate evidence <change>`.
- `packages/core/src/domain/EvidenceDiagrams.ts` (new) — sequence and class diagrams, pure.
- `scripts/cli/commands/quality/DoctorCommand.ts` — the runner's screenshot and video settings.
- `bin/specgate.ts`, the README table, `usage()`, docs (`docs/evidence.md`, es), and their tests.

## Mechanisms

AC-1 — `keepEvidence(projectDir, id, run, "before")` writes `.specgate/evidence/<REQ>/before/` — `run.json`, `run.log`, `artifacts/` — from the same `ScenarioRun` and `test-results/` scan as today. Callers: the acceptance seal's first run when `bdd: required` (the sealed files' requirements), `reproduce run` beside `red.json`, and `specgate evidence before <REQ>`, which runs `scenarioCommand(bdd_cmd, id)` on the working tree. A before is kept whether the run passed or failed; its exit code says which.

AC-2 — `apply`'s call writes `after/`. A reader (`readEvidence`) takes `after/` first, then the old flat layout, for one minor release.

AC-3 — `doctor` reads `playwright.config.{ts,js,mjs}` when `bdd_cmd` names Playwright or playwright-bdd and finds `screenshot:` and `video:` under `use:` by pattern; `evidence_media_off` (a warning) gives the two lines to add. Any other runner: not judged.

AC-4 — `EvidenceDiagrams`:
- `sequenceOf(scenario, actor)`: participants are the actor, the system, and each `METHOD /path` a step names; GIVEN steps become a note, WHEN steps messages from the actor, THEN steps replies. Before: the requirement's scenarios in the spec at the base (`git show <base>:<spec file>`, the base resolved as `check --affected` does); after: now. A new requirement has no before.
- `classesOf(file, source)`: one regex reader per language family for `class|interface|record|data class` and their public members and `extends`/`implements`/`: Base`; private members and bodies are skipped. Before from `git show <base>:<file>`, after from the working tree, for the files the requirement's code column links. Members added are marked `+`, removed `-`, in a note.
- Both return Mermaid text; same input, same text.

AC-5 — `specgate evidence <change>` writes `docs/specs/changes/<change>/EVIDENCE.md` and `evidence/` beside it: per requirement of the change, a two-column table of the first and last screenshot of each scenario (copied, each under 300 KB, else named and not copied), the diagrams, and the paths of video and trace under `.specgate/evidence/`. A requirement with no before, no after or no media gets a line saying which, and the command to get it. `archive` carries the page with the change.

## Channels

None: local files. CI may upload `.specgate/evidence/` as a build artifact; docs show how.

## Decisions

See ADR-0047. Phased in three commits inside this change: 4a before/after and doctor (REQ-803, 804, 805), 4b diagrams (REQ-806), 4c the page (REQ-807).
