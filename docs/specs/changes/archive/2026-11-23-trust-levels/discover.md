# Discover: trust-levels

> Owner: product — what the business needs and why. No technology here: the
> design says how.

## Context

A team that hands work to agents trusts them all or none. Today the harness
runs unattended and `--chain` merges whatever is green, in every area of the
product alike: the area a bug just escaped from gets the same freedom as the
one that has been green for months. Teams that run agents at scale (Lauren
Tan's trust curve, GrokBot) earn that freedom step by step, per area, with
evidence: watch locally, then controlled changes, then independent
verification, then unattended runs, then error triage, and only then merging
alone. Specgate already has every step except the ladder itself: nothing says
how far an agent may go in a given area, nothing raises it on evidence, and
nothing lowers it when a bug escapes.

## Use case

1. The Developer writes the level of each module of the product in the gate
   policy: payments at 2, catalogue at 4.
2. The harness runs on its own only where the level allows it, and says why it
   skipped the rest.
3. The Developer asks how much each module has earned: its level, its green
   deliveries since the last escaped bug, and the promotion it is ready for.
4. A promotion is proposed as a change; a person approves it, and only then
   does the level rise.
5. A bug reported in a module lowers its level by one at once, with no
   approval needed.

## Acceptance criteria

- AC-1: each module of a project can declare a trust level from 1 to 5, checked by the gate; a project that declares none keeps working as today.
- AC-2: the harness does in a module only what its level allows, and says what it skipped and why.
- AC-3: a level never rises without a change a person approved.
- AC-4: a bug reported in a module lowers its level at once.
- AC-5: the Developer sees each module's level and the evidence behind it, and which promotion it is ready for.
