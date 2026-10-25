# Proposal: draft-reserve-more

## Intent

A draft opened from a brief reserves ten requirement ids, and nothing could grow them once it was open. A module that needed more had to squeeze: in an adopter's project, two modules ran out and the agents folded new behaviour into requirements that already existed, which made them harder to review and to build one at a time.

## Scope

`specgate propose --from-brief <module> --reserve <n>` on a draft that is already open grows its requirement and scenario ranges to n ids and rewrites DRAFTING.md with them, leaving the agent's files alone. Ranges are consecutive, so it is refused (`draft_range_not_last`) when ids after the draft are reserved or used elsewhere, and (`draft_range_already_holds`) when n is not more than the draft holds.

## Out of scope

Ranges made of more than one interval, which would let any draft grow: every reader of `req_range` would have to learn them, and that is a decision of its own.
