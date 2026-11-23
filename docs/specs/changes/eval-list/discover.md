# Discover: eval-list

> Owner: product — what the business needs and why. No technology here: the
> design says how.

## Context

A skill's exam runs from the command line, and its history stays in a file
nobody opens. The Developer wants to see, in the studio, each skill that has
an exam, how each version of the skill did, and an exam in progress beside
the agents building — "and the evals, skills and exams?" (2026-11-23).

## Use case

1. The Developer asks which skills have an exam: each one with its tasks,
   which of them hide their check, and how every version of the skill did,
   better or worse than the one before.
2. While an exam runs, anyone can see how far it got.
3. The Developer reads the exam itself — the skill and each task's text —
   the exact prompt each run handed the agent, and each run's log as it is
   written: what the agent said, `specgate check`'s verdict and the hidden
   check's (2026-11-23: "I have to be able to see the exam's text, the
   prompts, a kind of logs in real time").

## Acceptance criteria

- AC-1: every exam of the project is listed with its skill, its version now, its tasks and its history per version, each compared with the previous version.
- AC-2: an exam in progress says how many runs it has and how many have ended, correct or not.
- AC-3: each run keeps its prompt and its log, written as it happens, and the list names where they are; the exam's texts are in the list.
