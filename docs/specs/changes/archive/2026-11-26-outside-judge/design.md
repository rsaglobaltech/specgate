# Design: outside-judge

> Owner: architecture — how it is built. Requirements live in the delta.

## REQ-745 — delivery asks for the approval (AC-1)

`specgate apply` asks `missingApprovals` — the question the harness already
asks (REQ-315) — of the open change that owns the requirement, before it writes
the status. Same setting, same way out: `approvals: { required: never }`. A
requirement written straight into `spec.md` has no change and is not asked.

- `scripts/cli/commands/spec/DoneCommand.ts`

## REQ-746 — a person's acts, refused to the agent (AC-2)

A pure rule reads a shell command and a written path and names the act:

- approving: `specgate change approve`;
- switching the guard: `agent_guard`, `SPECGATE_GUARD`;
- reviewing steps: `--steps-reviewed`, `SPECGATE_ASSUME_TTY`;
- the controls' own files — `.specgate/config.json`, `.specgate/gate.yaml`, `.specgate/evidence/`, a change's `approvals.json` — written, moved or removed.

Reading any of them is allowed. The guard asks the rule before anything else,
for the shell and for the write tools, in Claude Code's hook and in both
OpenCode bridges. The guard's refusals stop saying how to switch it off: that
line is for a person and lives in the docs and in `specgate agents install`.

The OpenCode bridge reads the switch once, when the plugin loads, and holds it:
a session cannot switch off the guard it started with.

A command's text can be disguised; this is the near control, not the last one.
REQ-747 is the one that does not take the session's word.

- `scripts/plugin/person-acts.ts` (new)
- `scripts/plugin/guard-hook.ts`
- `scripts/plugin/opencode-bridge.ts`
- `scripts/plugin/project-state.ts`

## REQ-747 — the judge outside the session (AC-3)

`controlsOf(projectDir)` reads what the controls are: the guard's switch, the
gate policy, each open change's approvals, the evidence there is, the steps a
person is said to have reviewed. The harness and the exam read it before the
agent starts and keep it in their own memory — not in the worktree, not in the
sandbox — and read it again when the agent stops. A pure diff names what the
session changed; any of it fails the attempt, or the run, with
`controls_changed_by_session`.

The record of the steps is born inside the session, so nothing before it knows
it. The guard writes it to the hook log as well — the exam keeps that log away
from the project — and the judge reads the steps against the log: a record
removed is seen, and so are steps changed after it.

- `packages/core/src/domain/ControlRecord.ts` (new)
- `scripts/lib/controls.ts` (new)
- `scripts/plugin/project-state.ts`
- `scripts/harness/run/attempt.ts`, `scripts/harness/run/gate.ts`
- `scripts/cli/commands/harness/CompatCommand.ts`, `packages/core/src/domain/Compat.ts`

## What stays as it was

AC-1 — `apply` asks `missingApprovals` before it writes the status.
AC-2 — the guard asks the rule of a person's acts first; its refusals lose the line about the switch.
AC-3 — the harness and the exam diff the controls read before and after, held in their memory.
AC-4 — the rule matches the agent's tool calls only: a person's own prompt goes through no hook, and a session that names no control matches nothing.

## Not here

- Running one's own agent with no harness and no CI: REQ-745 and REQ-746 act, REQ-747 has no judge to run in. The docs say so.
- A gate that runs no scenarios takes the test's word (the exam's `trap`): gate-runs-scenarios is that control.
