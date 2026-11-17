# Discover: agents-first-class

> Owner: product — what the business needs and why. No technology here: the
> design says how.

## Context

A person using specgate with Codex found `harness.config.yaml` always naming
Claude, the studio's Codex command refused by today's Codex, no specgate steps
inside Codex, and no single page saying what to give an agent to start
(issue #480). People told their agent to "study specgate first", which costs
tokens and differs from one agent to the next.

## Use case

A team that works with Codex, OpenCode or Claude Code sets a project up, then
pastes one prompt into its agent to start.

## Acceptance criteria

- AC-1: The agent a project uses is the one specgate configures, and Codex's command is one its CLI accepts.
- AC-2: Codex gets specgate's steps, as Claude Code and OpenCode do.
- AC-3: A person gets, from the project, what to paste into their agent, in English.
