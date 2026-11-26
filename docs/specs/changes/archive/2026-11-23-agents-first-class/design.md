# Design: agents-first-class

> Owner: architect — how the system meets the Discover. Name each acceptance
> criterion (AC-1, AC-2…) where it is answered.

## Modules

`scripts/cli/commands/project/readiness.ts`, `scripts/agents/init.ts`,
`scripts/lib/studio-route.ts`, `scripts/cli/commands/spec/StatusCommand.ts`,
`packages/core/src/domain/AgentKickoff.ts`, `docs/agent-kickoff.md`.

## Mechanisms

- AC-1 — `AGENT_COMMANDS.codex = codex exec -s workspace-write - < {prompt_file}`;
  `preferredAgent`: the agent whose folder or instructions the project carries
  (`.codex/`; `.claude/`, `CLAUDE.md`) when installed, else the first installed;
  `adopt`/`init` and `agents init` without `--tool` use it; `--tool codex` sets
  Codex; the studio's preset drops `--full-auto`, which Codex removed.
- AC-2 — `agents init --tool codex` (or a project with `.codex/`) also writes
  the skills to `.agents/skills/`, which Codex reads (`$specgate-draft`…).
- AC-3 — `specgate status --prompt [start|draft|build]`: `agentPrompt` builds
  the text from the status document (next step, the brief's undrafted modules) and
  the agents installed; `docs/agent-kickoff.md` holds the same prompts.

## Channels

No new command: `status`, which already says what comes next, says it for an agent with `--prompt` (`prompt` in its JSON); `agents init` ends by pointing at it. A new flag: a minor release.

## Decisions

The prompt tells the agent to follow specgate, not to study it: AGENTS.md,
status and DRAFTING.md already say what each step needs.
