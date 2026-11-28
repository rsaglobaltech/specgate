# Design: brief-guides

> Owner: architect — how the system meets the Discover. Name each acceptance
> criterion (AC-1, AC-2…) where it is answered.

## Modules

`scripts/cli/commands/spec/DraftCommand.ts`, `scripts/cli/commands/change/ChangeCommand.ts`, `scripts/agents/commands.ts` and the plugin's skills and commands it generates, `docs/commands.md`, `docs/es/commands.md`, and their tests.

## Mechanisms

AC-1 — `parseArgs` reads `--guide setup|cards`; any other value throws, which `execute` answers as `draft_usage`. A `guide` branch runs before the others: `setup` prints `briefSetupGuide(rel)`, `cards` prints `briefCardsGuide(rel, briefModules(text))`, or fails with `draft_guide_no_modules` when the list is empty. With `--json` the guide is under `draft.guide`. No file is written.

AC-2 — the `draft` step's guidance names `specgate propose --from-brief --guide setup` and `--guide cards`; `npm run plugin:sync` regenerates the plugin's copies. The overview names `--guide setup` where the front matter needs fixes and `--guide cards` where the front matter is complete and the brief has no section.

## Decisions

The files `--agent` writes stay: its prompt says the guide is also saved there, and REQ-260 removes BRIEF-SETUP.md once used. Writing BRIEF-CARDS.md on every run was rejected: a brief without sections is valid, and the file would stay untracked.
