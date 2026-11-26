# Discover: skill-evals

> Owner: product — what the business needs and why. No technology here: the
> design says how.

## Context

Phase 5 of the trust curve (docs/specs/trust-curve.md): skills examined.
Every lesson an agent is taught — a skill, an instruction — piles up, and
nobody can tell whether a skill still helps, whether its new version is
better or worse, or whether it only makes the code correct and not good.
Teams that trust their agents examine them: the same tasks, several agents in
parallel, an objective judge for what is correct, a reviewer for what is
good, and a history per version of the skill.

## Use case

1. The Developer writes the exam of a skill: a few fixed tasks, each a small
   project and what to build.
2. They run it: every task several times, in parallel, each run on a clean
   copy, the skill handed to the agent.
3. They read, per task and overall, how often the result was correct and how
   good it was, and whether this version of the skill did better or worse
   than the one before.

## Acceptance criteria

- AC-1: an exam runs each task several times in parallel, each on a clean copy with the skill handed to the agent, and scores correct — the gate passed — and good — architecture, quality and an optional reviewer.
- AC-2: each exam is kept per version of the skill, and the result says whether it did better or worse than the previous version.
