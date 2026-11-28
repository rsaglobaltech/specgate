# Discover: evidence-attempts

> Owner: product — what the business needs and why. No technology here: the
> design says how.

## Context

Delivering a requirement on a real project on 2026-11-27, two deliveries in a
row were refused: the AI model judged the same idea allowed once and unclear
the next. Only the record of what the model decided showed it, and nothing
kept the refused deliveries: the evidence showed a clean before and after,
and the flakiness was lost.

## Use case

The reviewer sees, beside the before and the after, each delivery that failed
on the way: why, and what the AI decided in it.

## Acceptance criteria

- AC-1: a delivery whose scenarios fail is kept, numbered, with what its run wrote.
- AC-2: the evidence page lists the failed attempts with why each failed and what the AI decided.
- AC-3: a new before starts again: the attempts after the old one are gone.
