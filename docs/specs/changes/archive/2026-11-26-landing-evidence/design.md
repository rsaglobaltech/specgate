# Design: landing-evidence

> Owner: architect — how the system meets the Discover. Name each acceptance
> criterion (AC-1, AC-2…) where it is answered.

## Modules

`docs/index.html` and `docs/es/index.html` (the two landing pages), `docs/assets/home.css` (their styles), `tests/unit/landing-evidence.test.ts` (new). No source file of the CLI changes. Nothing the existing landing tests pin is removed: the daily loop and its commands, the claims, the counts, the terminal player, the agent tools, the version, the routes to the documentation.

## Mechanisms

AC-1 — the hero becomes a dark band with two figures side by side: "Without Specgate", a closed loop in which the agent writes the code, writes the tests and grades itself; "With Specgate", the agents (Claude Code, Codex, OpenCode) whose work meets a gate that a person approves, the shortcuts bouncing back, and the work delivered. Each carries its figure from the paper's replication on the released version: 44% (16 of 36) and 92% (33 of 36), p < 0.001. Icons are inline stroke SVG; no image file, no external script.

AC-2 — a section "The judge sits outside the session" with a figure of the trust boundary (agent, guard, working folder, gate inside; person, outside judge, verdict outside) and a section with the guard's decision on one tool call and the gate's stages. Each figure is inline SVG in a `<figure>` with `role="img"`, an `aria-label` and a `<figcaption>`; colours come from the page's tokens.

AC-3 — a table of the nine controls (C1–C9): name, what it refuses, what an agent tried in the exam; and a short "Next" panel for sealed acceptance tests. The Spanish page carries the same sections in Spanish.

## Decisions

The figures are the paper's (`paper-runs-2026-11-25`), and the page states their limit (the wrong-test tasks) beside them. No figure is shown that the exam did not measure.
