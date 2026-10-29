# Proposal: change-layers

## Intent

At enterprise scale a change is written by several people: product says what the
business needs, the architect how the system meets it, the developer the work
that delivers it (docs/specs/enterprise-sdd-gap.md, item 2). A 0.27 change is one
`proposal.md` that mixes the three, and its optional `design.md` has no owner and
nothing checks it.

## Scope

- New changes carry three layers with an owner each: `discover.md` (product),
  `design.md` (architect), `tasks.md` (developer), under the `layered` schema.
- A 0.27 change stays valid: its `proposal.md` is its Discover, and a missing
  `design.md` is a warning naming `specgate migrate 1.0`.
- Layer rules: no technology in the Discover, the Design answers every
  acceptance criterion, every task names a requirement.
- The business story stays put: rewriting the agreed Discover is a warning.
- `change new`, `propose --from-brief` and `--from-ticket` scaffold the layers;
  `change status` names the next layer and its owner; the studio's review lists
  the layers with their owners.

## Approach

ADR-0041. A new built-in schema, `layered`, whose artifacts are the three layers
plus the deltas; the rules live in a pure domain module, `ChangeLayers`.
