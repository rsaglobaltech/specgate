# Design: guard-scope-and-seal-run

> Owner: architect — how the system meets the Discover. Name each acceptance
> criterion (AC-1, AC-2…) where it is answered.

## Modules

`scripts/plugin/guard-hook.ts`, `scripts/plugin/project-state.ts`, `scripts/lib/acceptance.ts`, `scripts/cli/commands/change/ChangeCommand.ts`, `compat/writer-prompt.md`, `docs/sealed-acceptance.md`, and their tests.

## Mechanisms

AC-1 — `designScope` in the plugin's project state reads the designs of the approved open changes as the gate's rule `scope` does (repeated: the plugin's scripts stand alone), empty when the rule is off. The guard's write decision refuses a path that does not exist yet and is not among them, before it looks for a test.

AC-2 — `firstAcceptanceRun` runs `acceptance_cmd` on the sealed files; `change approve --layer acceptance` prints whether they pass and the lines that say why, not a stack's tail. It refuses nothing: before the code exists, failing is expected. The exam's writer prompt adds that the code is loaded by the design's path, counted from the test's own folder.

## Decisions

The tests that approve a change as a person (shortcut-proof, outside-judge) now say so with `SPECGATE_ASSUME_TTY`: they passed only inside `apply`, whose runner sets it.
