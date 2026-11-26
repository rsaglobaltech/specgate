# Discover: approved-delta

> Owner: product — what the business needs and why. No technology here: the
> design says how.

## Context

What a person approves in a change is what the system must do and how it is
checked: the requirements and their scenarios. Measured on 2026-11-24: an agent
without Specgate's rules, facing a test that contradicted a scenario, rewrote the
approved requirement, its scenario and spec.md to say what the test said — and
`specgate check` passed, five times of five. Tried by hand: an approved
requirement changed from "0.50 a day, at most 10.00" to "1.00 a day, at most
20.00", and the gate said the same before and after.

An approval remembers the change's discover, design and tasks, and asks again
when one of them changes. It does not remember the requirements. In a change of
lite rigor it remembers nothing: a date.

## Use case

1. A person approves a change: its requirements and scenarios are sealed as approved.
2. Someone — an agent, a colleague — changes a requirement or a scenario afterwards.
3. The gate fails, naming the requirement and what changed, until a person approves the change again.
4. A correction that is meant goes the same way: change it, approve it again.

## Acceptance criteria

- AC-1: approving a change seals each of its requirements — the statement and the scenarios — at every rigor.
- AC-2: the gate fails when a requirement of an approved change differs from what was sealed, was added, or was removed, naming it; approving again seals what is there.
- AC-3: delivering a requirement — its status written by `apply` — is not a change to it.
- AC-4: a change approved before seals existed is not failed: it is said to be unsealed, with the way to seal it.
