# Discover: approve-around-questions

> Owner: product — what the business needs and why. No technology here: the
> design says how.

## Context

The methodology says a requirement the client has not decided waits —
marked Needs Clarification, its question open — while the rest of the change
is built. Since 1.6 nothing of a change is delivered until a person approves
it, and an open question blocks approving the whole change. One question for
the client now stops every requirement of the draft, including those it has
nothing to do with. Following the getting-started guide, a newcomer meets this
on the first day.

## Use case

1. A draft has four requirements; the client has not decided the fee of one,
   which is marked Needs Clarification, its question open.
2. A person approves the change: the three that are decided can be built and
   delivered; the fourth stays undelivered — `apply` and the harness refuse it.
3. The client answers; the fourth is written out, which changes what was
   approved, and a person approves again before it is delivered.

## Acceptance criteria

- AC-1: an open question that blocks only requirements in Needs Clarification does not block approving their change; one that blocks a requirement not marked so still does.
- AC-2: a requirement in Needs Clarification of an approved change is still refused by `apply` until it is answered, and once written out it needs approving again.
