# Discover: feature-map

> Owner: product — what the business needs and why. No technology here: the
> design says how.

## Context

Phase 1 of the trust curve (docs/specs/trust-curve.md): verify with evidence.
An agent that is told "done" by its own tests still ships what a person finds
broken the moment they open the app. Teams that trust their agents give them
two things: a map of where each feature lives and how to reach it, so the
agent can open the app and check its own work like a person would; and a
record of what proved each delivery, kept after the fact. Specgate knows most
of the map already — each requirement's use case, feature, code and tests —
but never says where in the app it is reached, never hands that to the agent,
and keeps nothing of what `apply` saw pass.

## Use case

1. The Developer, or the agent, asks for the map: for each requirement, its
   use case, who uses it, where in the app it is reached, its feature, code
   and tests.
2. The harness hands the agent the requirement's place in the app: the route,
   the app's address, the end-to-end tests that already reach it, and the
   instruction to open it and see the behaviour before and after the change.
3. When the gate accepts a requirement, what proved it is kept beside it: the
   commands that ran, their result, the scenarios' output and the screenshots
   and traces the browser tests left.

## Acceptance criteria

- AC-1: the map lists every requirement — delivered or in an open change — with its use case, actor, surfaces, route and address when known, feature, scenarios, code, tests and end-to-end tests.
- AC-2: the route comes from the requirement's trace, or from the first page an end-to-end test that names it opens.
- AC-3: the agent's prompt says where the requirement lives in the app, and how to open it, whenever the map knows.
- AC-4: `apply` keeps, per requirement, a record of what proved it and the browser tests' screenshots and traces; the heavy files stay out of git.
