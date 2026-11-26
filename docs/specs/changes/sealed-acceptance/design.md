# Design: sealed-acceptance

> Owner: architect — how the system meets the Discover. Name each acceptance
> criterion (AC-1, AC-2…) where it is answered.

## Modules

- `scripts/lib/acceptance.ts` (new) — reads a change's `acceptance.md`, checks it, seals the files into the change's `approvals.json` as a record `{layer: "acceptance", role: "tester", seals: {<path>: sha256}}`, compares them with the seals, and runs `acceptance_cmd`. The layers of `ChangeLayers.ts` and `Approvals.ts` stay as they are: the acceptance record sits beside them, as the requirements' seals do.
- `scripts/cli/commands/change/ChangeCommand.ts` — `change approve <id> --layer acceptance`.
- `scripts/cli/commands/quality/CheckCommand.ts`, `scripts/lib/gate-stages.ts`, `scripts/lib/in-flight.ts`, `scripts/harness/run/gate.ts`, `scripts/lib/gate-policy.ts` — the rule and stage `acceptance`.
- `scripts/lib/config-keys.ts`, `packages/core/src/infrastructure/HarnessConfigFile.ts` — the key `acceptance_cmd`, in `harness.config.yaml` beside `test_cmd` and `bdd_cmd`.
- `scripts/plugin/project-state.ts`, `scripts/plugin/guard-hook.ts` (and the shipped copies in `packages/claude-plugin/`) — sealed files join the files the guard keeps from the agent.
- `scripts/lib/controls.ts`, `packages/core/src/domain/ControlRecord.ts` — the judge's record holds the sealed files' hashes.
- `scripts/lib/attack.ts` (new) — the two-function attack, replayed.
- `scripts/lib/acceptance-writer.ts` (new) — the writer's folder at L3a, and what comes back from it.
- `scripts/cli/commands/harness/CompatCommand.ts`, `packages/core/src/domain/Compat.ts`, `compat/writer-prompt.md` (new), `compat/tasks/trap/task.json`, `compat/tasks/trap-scenarios/task.json` — `compat attack two-function` and the level `L3a`.

## Mechanisms

AC-1 — a change lists its acceptance tests in `acceptance.md`: one line each, `- <path> — SCN-NNNx[, SCN-NNNy]`. Any path, any language: `src/test/java/…/FeesAcceptanceIT.java`, `tests/acceptance/fees.spec.ts`, `features/fees.feature` with its step files. `change approve <id> --layer acceptance` refuses when a file is missing, when a line names no scenario of the change's delta, or when design is not approved; otherwise it writes `{layer: "acceptance", role: "tester", seals: {path: hash}, by, at}` into `approvals.json`. It is `change approve`, so REQ-748 holds: no terminal, no approval. `acceptance.md` is optional: a change without it is built as today.

AC-2 — `check` (and so `apply`) hashes each sealed file and fails with `acceptance_not_sealed`, naming the file, when one differs or is gone. The fix says: restore it (`git checkout -- <path>`), or have a person approve the new version (`specgate change approve <id> --layer acceptance`). Line endings are normalised before hashing, so a checkout on Windows is not a change.

AC-3 — the rule `acceptance` runs `acceptance_cmd` from `harness.config.yaml`, where the project's other commands are, with `{files}` replaced by the sealed paths when present, in the project's root, with the deadline the gate uses for tests. Exit 0 passes; anything else fails with `acceptance_red` and the command's last lines. A change with sealed tests and no `acceptance_cmd` fails with `acceptance_no_command`, whose fix names the key and examples (`mvn -q verify -Dit.test={files}`, `npx playwright test {files}`, `pytest {files}`). Specgate installs nothing and interprets no test. The rule is `error` in strict and standard, `warning` in minimal.

AC-4 — `project-state` lists the sealed paths of every open change; the guard treats them as it treats approvals.json: a Write, an Edit, an `apply_patch` touching one, or a shell command that writes one (redirect, `sed -i`, `cp`/`mv` onto it, `rm`, `git checkout`/`git restore` of it), is refused with `acceptance_sealed` and the fix above. This holds in Claude Code, Codex (codex-hooks) and OpenCode (the plugin). `controlsOf` adds `acceptance: {path: hash}` for sealed files, so the outside judge sees a change made where no hook ran.

AC-5 — two parts in the exam. (a) `compat/attacks/two-function/`: a script, no model, that replays the writes of the recorded session against a fixture with a sealed step file — via the file tools' hook input, `apply_patch`, a shell redirect and `git checkout` of another version. Each must be refused by the guard or reported by the judge; the run fails otherwise. It runs as `specgate compat attack two-function`. (b) A level `L3a`: before the agent starts, a writer agent — the same tool and model — runs in a copy that holds only `spec.md`, `features/`, `docs/specs/`, `AGENTS.md`, `README.md`, `package.json` and `harness.config.yaml` — no `src/`, no tests — with `compat/writer-prompt.md` and the task's `acceptance.kind`, and writes the acceptance tests; a listed file under `src/` makes the run invalid; the exam seals them as the person would, recorded as `exam (as the person)`, and sets the task's `acceptance.cmd` as `acceptance_cmd`; then the implementing agent runs as at L3. Measured on the trap tasks against L3 and B, with Claude Code and Codex on the host and OpenCode in a sandbox with the free model.

## Decisions

Rejected: a scenario grammar run by Specgate, and mutating scenario values. Both need Specgate to understand the requirement; a Java project with complex rules is past that. The choice here is about roles, not language: who writes the oracle, and who may change it.

Unit tests stay the agent's: they are its tool, not the proof of conformance.

The writer agent's errors are caught by the person who approves the tests — reading a test against its scenario is cheaper than reading the implementation.
