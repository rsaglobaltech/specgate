# Design: walkthrough-fixes-2

> Owner: architect — how the system meets the Discover. Name each acceptance
> criterion (AC-1, AC-2…) where it is answered.

## Modules

`scripts/agents/init.ts`, `scripts/harness/run/requirement.ts`, `packages/core/src/domain/DraftChecklist.ts`, `scripts/cli/commands/spec/DraftCommand.ts`, `scripts/lib/controls.ts`, `scripts/cli/commands/specops/DiffCommand.ts`, `scripts/cli/commands/specops/SyncCommand.ts`, `docs/agents.md`, `docs/start/scratch-3-build.md`, and their tests (`tests/unit/walkthrough-fixes-2.test.ts`, `tests/unit/draft-from-brief.test.ts`).

## Mechanisms

AC-1 — in a Specgate project (`spec.md` or `docs/specs/`), `writeAgentFiles` writes the `claude-plugin` files under `.claude/specgate-plugin/`; the guard never judges a path under a dot folder. Given another folder, as the docs tell, there.

AC-2 — the harness stops a requirement whose readiness says `requirement_needs_clarification` before any worktree or agent, saying it waits for an answer.

AC-3 — D6 counts a value as sourced when an answered question's Answer cell, for a question that blocks the requirement, states it.

AC-4 — `moduleStatus` says whether a ready draft is approved; `draftNextCommand` names `specgate change approve <change>` until it is, and propose's numbered steps put approval before `apply`.

AC-5 — `branchControls` copies, beside the base's control files, the base's approvals of archived changes and the sealed tests themselves, so an unchanged sealed test reads unchanged.

AC-6 — `specops diff` exits 1 when a pack's expansion fails; `specops sync` exits 1, naming the ids, when `spec.md` holds a requirement id twice after the merge.

## Decisions

The id clash is reported, not resolved: which requirement keeps the id is a person's call.
