# Discover: harness-compat

> Owner: product — what the business needs and why. No technology here: the
> design says how.

## Context

Specgate says it works from many agent tools; it has been seen working from two
(Claude Code in pintamundo-ai, OpenCode in lab 2). A team choosing Specgate needs
to know, for the tool it already uses, whether the loop holds — measured, not
claimed. This change covers F0 and F1 of the approved plan
(~/Documents/specgate-plans/harness-compat-plan.md): Claude Code, Codex and
OpenCode, the matrix internal first.

## Use case

1. The Developer runs the compatibility exam for Claude Code, Codex and OpenCode.
2. Each tool gets the same small project with one pending requirement, at each level of integration it supports, three times.
3. The gate and a hidden test judge every run; the agent's own claim counts for nothing.
4. The Developer reads one internal matrix: tool × level, green, amber or red, with the tool's version, model and date.

## Acceptance criteria

- AC-1: one command runs the exam for a tool, a level and a number of runs, on a clean copy each time, and records each run's verdict.
- AC-2: each level gives the tool exactly its integration — rules only, then skills or commands, then MCP, then the plugin — and a level it has no form for is "n/a", not a failure.
- AC-3: Codex and OpenCode can be given Specgate's MCP server; the exam never changes the Developer's own global configuration.
- AC-4: a run's agent never sees a provider key it was not given; the company key never reaches it.
- AC-5: a cell is green at 3 of 3, amber at 1–2, red at 0.
- AC-6: one internal matrix, generated from the runs, dated, with each tool's version and model.
