# Discover: codex-guard

> Owner: product — what the business needs and why. No technology here: the
> design says how.

## Context

Claude Code and OpenCode run Specgate's three guards in the agent's loop: the
session hears the open change, a write to source code waits for its test, and
the gate speaks when the agent stops. Codex ran none of them. In the exam of
2026-11-25 it was the tool with the worst results and the only one an agent
could approve its own change in: nothing in the session said no.

Codex 0.154 has hooks, stable, in the same shape as Claude Code's — measured:
`PreToolUse` with `Bash` and `apply_patch`, `Stop`, and a refusal by exit code 2
that the agent reads.

## Use case

1. The Developer runs `specgate agents init --tool codex-hooks` in the project.
2. Codex asks them once to trust the project's hooks.
3. From then on a Codex session hears the open change, a patch to source code waits for its test, a person's acts are refused, and the gate speaks when the agent stops.

## Acceptance criteria

- AC-1: the project gets Codex hooks that run Specgate's guards, without writing over hooks a person wrote.
- AC-2: a patch is judged as a write is: each file it adds, updates or moves to.
- AC-3: the exam runs Codex with them at its highest level.
