# Design: agent-routing

> Owner: architect — how the system meets the Discover. Name each acceptance
> criterion (AC-1, AC-2…) where it is answered.

## Modules

- `packages/core/src/domain/ProfileMatch.ts` — the `module` key.
- `scripts/harness/run/requirement.ts` — the requirement's module in its facts.
- `scripts/cli/commands/spec/DraftCommand.ts`, `HarnessConfigFile.ts`, `config-keys.ts` — `draft_profile`.
- `scripts/lib/agent-doctor.ts` (new), `scripts/harness/doctor.ts` (new) — the check.
- `scripts/harness/run/prepare.ts` — the check before a run.

## Mechanisms

- AC-1 — `.harness/profiles.yaml` rules match `module:` against the
  requirement's capability (`requirementCapabilities`), first match wins as
  for the other keys.
- AC-2 — `draft_profile` in harness.config.yaml names the profile whose agent
  drafts: `draft <module>` and `propose --from-brief <module>` without
  `--agent` or `--profile` run it; `--no-agent` keeps today's behaviour (the
  drafting guide written for your own agent).
- AC-3 — `specgate harness doctor [--json] [--no-probe]`: each pending
  requirement with its module and the profile and agent it gets (requirement
  rule, module rule, other rule, default); each distinct agent once — its
  program on PATH (the first word after `env` and its options and `VAR=`),
  then a probe: the command run with a prompt file that says `Reply with
  exactly: OK`, 120 s at most, passing when it exits 0 and its output says OK;
  a failure keeps the last line the agent printed (an expired key, a quota)
  and a fix. The drafting agent is checked the same way.
- AC-4 — `harness run`, before any worktree, runs the doctor for the agents of
  the requirements it will process (once per command, the probe included)
  and refuses with `harness_agent_unavailable` naming the requirements, the
  agent and the reason; `--skip-doctor` runs anyway.

## Channels

None: files and the CLI. The studio reads `harness doctor --json` (a studio
change).

## Decisions

The probe costs one short call per agent, and is what tells an expired key or
a spent quota from a working agent; `--no-probe` checks only installation.
