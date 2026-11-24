# Discover: agent-routing

> Owner: product — what the business needs and why. No technology here: the
> design says how.

## Context

The language model that drafts — the brief turned into modules, requirements
and scenarios — and the agent that builds are two jobs, and a team may want
two providers or models for them. When building, a team wants to choose the
agent per module or per requirement: a delicate module with a stronger model,
the rest with a free one. And trying specgate end to end on a real project
(2026-11-23) showed what goes wrong when nobody checks first: an expired key,
a free model out of quota, an agent not installed — each found only after a
run had started.

## Use case

1. The Developer sets the agent that drafts, and the agents that build: a
   default, one for a module, one for a requirement.
2. Before building, specgate says which agent each module and requirement
   will get, and checks that every one of them is installed and answers.
3. A run whose agent does not answer does not start: it says which, why, and
   how to fix it.

## Acceptance criteria

- AC-1: a module can have its own agent, as a requirement can.
- AC-2: the agent that drafts is set apart from the agents that build.
- AC-3: the agents a project uses are checked before they are used — installed, and answering — and each one that fails says why and how to fix it.
- AC-4: a run refuses to start when an agent it needs fails that check.
