# Design: shortcut-proof

> Owner: architect — how the system meets the Discover. Name each acceptance
> criterion (AC-1, AC-2…) where it is answered.

## Modules

- `scripts/plugin/guard-hook.ts`, `scripts/plugin/project-state.ts` — the guard judges the working tree, not the call (AC-1).
- `scripts/plugin/opencode-bridge.ts` and the Claude plugin's hook list — every tool call reaches the guard, the shell's too (AC-1).
- `scripts/lib/step-seal.ts` (new) — the record of a requirement's step definitions, and what changed since (AC-2).
- `scripts/cli/commands/spec/DoneCommand.ts`, `scripts/harness/run/gate.ts` — `steps_changed_after_code`, `--steps-reviewed` (AC-2).
- `packages/core/src/domain/DesignScope.ts` (new, pure) — the source files a design names; which new files it does not (AC-3).
- `scripts/cli/commands/quality/ValidateSpecsCommand.ts`, the gate policy — the rule `scope` (AC-3).

## Mechanisms

- AC-1. Today the guard asks "is this call a write to source?". It will ask "does the working tree hold changed source with no changed test naming a requirement of the change?" — on every call. Then a file written by `cat >`, by a script or by any tool is caught at the next call, with no parsing of shell commands. Allowed in that state: reads, and writes whose target is a test file. One call gets through — the one that wrote the file — and nothing after it.
- AC-2. When the guard first allows a source write for a requirement — or the harness starts its attempt — it records the hashes of the step definition files under `.specgate/evidence/<REQ>/steps.json`. `apply` and the harness gate compare. A project with no hook and no harness has no record: apply says so (SCN-743d) and passes, as today.
- AC-2. `--steps-reviewed` writes who said so into the requirement's evidence. It is a person's word, like `change approve`.
- AC-3. A design names a source file when it writes its path in backticks. New source files of the working tree, or of the harness's branch, are set against that list. Tests, features and docs are not source.
- AC-3. `scope` is a rule of `.specgate/gate.yaml` like the others: `warning` in `minimal` and `standard`, `error` in `strict`.
- AC-4. No dependency, no runner: hashes and a list of paths.

## What this does not close

- An agent that bends the steps before writing any code is not seen by AC-2. The order makes it rarer: it has not yet met the failure it would bend them to.
- `--steps-reviewed` and `change approve` can be run by a tool that approves its own commands outside the harness. Asking for a person at those commands is the decision left open in approved-delta, and still open.
- Whether src/export.js belongs to "the late fee" is a judgement. AC-3 catches the file nobody designed; code nobody asked for inside a designed file is for the reviewer.
- Without hooks — rules only — AC-1 does not exist, and AC-2 only speaks.
