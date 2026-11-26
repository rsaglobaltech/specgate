# Discover: compat-evidence

> Owner: product — what the business needs and why. No technology here: the
> design says how.

## Context

The first matrix (2026-11-24) is green everywhere: Claude Code, Codex and
OpenCode each delivered the one small requirement 3 of 3 at every level. That
proves the loop holds on an easy task. It does not say whether the agent used
Specgate's MCP server or plugin, whether Specgate changes anything compared with
no Specgate, how the tools behave on harder work, or which model each needs.

## Use case

1. The Developer runs the exam on several tasks, with and without Specgate.
2. Each run keeps what the agent did — its tool calls, what Specgate's server and plugin saw, its tokens and cost.
3. The Developer reads, per tool and model: what was delivered, whether the integration was used, and the cheapest model that is green with Specgate and without it.

## Acceptance criteria

- AC-1: each run records the calls Specgate's MCP server received and what its plugin refused, from Specgate's side, not from what the agent says.
- AC-2: each run keeps the tool's own session — its tool calls in order, tokens and cost — and says whether the test was written before the code.
- AC-3: a control condition runs the same task with no Specgate guidance or integration.
- AC-4: the exam has several tasks, each with its own hidden verdict: deliver, change delivered behaviour, a trap, a red gate to recover from, a request with no requirement.
- AC-5: the matrix shows delivery and use apart, a row per tool and model, per task.
- AC-6: a model ladder climbs one step only where a cell is not green and stops when it is; the report names the cheapest green model with and without Specgate, and the cost per delivered requirement.
- AC-7: a level with the server and no shell proves whether a client without a terminal can deliver.
