# Discover: evidence-details

> Owner: product — what the business needs and why. No technology here: the
> design says how.

## Context

A screenshot shows how a flow ended, not why it was red, what the service
answered, or what an AI model decided on the way. Reviewing a real project on
2026-11-27 — a request the model judged unclear, a 500 that became a 422 — the
reviewer had to open logs and traces by hand to learn each.

## Use case

The reviewer reads, for each requirement, why each scenario failed before and
passed after, what each call answered on both sides, and what the AI model
decided, beside the screens.

## Acceptance criteria

- AC-1: each scenario, before and after: passed or failed, how long it took, the step that failed and what was expected against what came.
- AC-2: each call a scenario made to the service, before and after: what was asked, the answer and its body, with secrets hidden.
- AC-3: what an AI model decided during the run — the model, what it was given, what it answered and how long it took — when the project records it.
