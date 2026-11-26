# Proposal: agent-ask

## Intent

specgate-studio's workbench has an agent panel beside the spec. A person asks
something about it — "allow cancelling up to 24 h before shipping @REQ-031" —
and the panel answers with a plan before anything is written: the files the
agent would change, each with a short why and its diff, and the specgate
command that checks the result. The person reads the diff and applies it, or
discards it. The panel also says what the agent read and the tokens it used.

The studio only shows and confirms; specgate does the work. Today the only way
to run an agent on the specification is `propose --from-brief --agent` or
`draft --agent`, which write into the working tree and undo what falls outside
the change. Nothing proposes first and writes on confirmation, and nothing
checks that the files did not change in between.

## Scope

In scope:

- REQ-520: `specgate agent ask "<request>" [--plan] [--json]` runs the
  configured agent (`--agent`, `--profile`, or `agent:`/`agent_profile:` in
  `harness.config.yaml`, as `propose --from-brief --agent` and the harness do)
  in a scratch copy of the project, outside the working tree, and answers the
  plan: `files` with `path`, `change`, `why` and `diff`; `then`; `read`;
  `usage`.
- REQ-521: `@REQ-NNN` and `@path` mentions, `--req` and `--file`, resolved to
  the agent's context and listed under `read`.
- REQ-522: the plan kept under the git folder (`specgate/plans/<id>/`) with
  the base commit, each file's hash and its planned content;
  `agent plans` and `agent discard`.
- REQ-523: mode `spec`, the only one: edits outside `spec.md`,
  `docs/specs/**` and `features/**` are refused and reported.
- REQ-524: `agent apply <id>` writes exactly the plan when every file still
  has its base hash, refuses `plan_stale` otherwise, and never commits.
- REQ-525: `apply` runs the plan's `then` commands — specgate checks only —
  and answers their findings.
- REQ-526: `agent_not_set`, `agent_failed` (exit or timeout, with stderr's
  tail) and the empty plan.
- REQ-527: `agentAsk`, `agentApply`, `agentDiscard` and `agentPlans` in the
  API; `API_VERSION` stays 1.0.0.

Out of scope:

- `--mode code`. A plan that edits code needs the gate behind it — tests
  first, then `apply` — which is what `harness run` already gives. Spec mode
  is the only mode; `--mode` with another value is refused.
- An MCP tool: the caller of `agent ask` is a person's tool; an agent asking
  another agent for a plan is not a use this change serves.
- Streaming the agent's progress while it works.

## Approach

`agent ask` lists the project's files with `git ls-files -co
--exclude-standard`, copies them into a temporary folder and records each
one's base state in a git repository kept beside that folder, never inside
it, so the agent sees an ordinary project and cannot reach the real one. The
agent runs there, with its own time limit, and leaves an optional
`.specgate-ask.json` with a reason per file, the `then` commands and what it
read; Claude Code's usage is read from its JSON output. What changed is read
from that repository, filtered by mode, and stored with the base hashes and the
new contents under the project's git folder. `apply` compares the hashes,
writes the stored contents byte for byte — no patching, so line endings stay
as they were — and runs the allowed `then` commands through specgate itself.
