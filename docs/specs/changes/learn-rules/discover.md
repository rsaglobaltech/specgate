# Discover: learn-rules

> Owner: product — what the business needs and why. No technology here: the
> design says how.

## Context

Phase 4 of the trust curve (docs/specs/trust-curve.md): from error to
barrier. Teams that trust their agents turn every review comment that keeps
coming back into a rule that checks itself: an instruction first, a barrier
once the instruction is still skipped. In specgate the same lesson is written
again and again — a review note on one draft, the same note on the next — and
the harness's failed attempts repeat the same stage of the gate, but nothing
notices the repetition, and nothing turns it into a principle.

## Use case

1. The Developer asks what keeps coming back: review notes alike across
   changes, and stages of the gate the agent keeps failing.
2. They pick a lesson and propose it as a rule: an instruction in prose, or a
   barrier the gate checks (`forbid=` a pattern, `run=` a command).
3. A person approves the change, and the rule is a principle from then on.

## Acceptance criteria

- AC-1: the lessons that repeat are listed with their evidence: review notes alike in different changes, and gate stages failed by the agent in several attempts.
- AC-2: a lesson becomes a principle only through a change a person approves; as an instruction, or as a barrier the gate checks.
