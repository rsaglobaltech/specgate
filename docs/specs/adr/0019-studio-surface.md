# ADR-0019 — One studio surface: `specgate studio`, not a standalone app

## Status

Accepted — 2026-08-16

## Context

Three separate tracks converged on the same idea — "let people *see* the spec
tree" — and each answered it differently. None knew about the others, because
they were written on branches that forked from the same commit.

1. **`mejoras/visual-pack-authoring-todo.md`, Phase 4.** Evaluated a StudioApp
   and deferred it: *"do not start"*, and if ever approved, *"scope as a thin
   CLI front-end via the VS Code extension webview, not a standalone app"*. Its
   gate conditions were: pack format stable, DDD opt-in shipped, `pack infer`
   shipped, explicit stakeholder buy-in.
2. **`mejoras/specgate-studio-brief.md` + `specgate-studio-handoff.md`.** Building
   exactly what Phase 4 forbade — a standalone Vite/React SPA in its own repo,
   with 15 requirements, as a dogfood experiment. Pack authored and tagged
   `v0.1.0`; the app itself is unimplemented and the handoff has been idle
   since 2026-05-15.
3. **`specgate studio`** (recovered in C0-11). A subcommand that serves a
   read-only HTML view of the spec tree from a local port, plus `--json`. No
   build step, no dependencies, ~300 lines.

Of the four Phase-4 gate conditions, two are met (`pack infer` shipped, the
pack format is stable behind a JSON Schema). "DDD opt-in shipped" and
"explicit stakeholder buy-in" are recorded nowhere as satisfied.

## Decision

**`specgate studio` is the studio surface.** It ships, it is the one we maintain,
and it is where visualisation features land.

**The standalone SPA (`specgate-studio-app`) stays a dogfood experiment and is
explicitly not a product.** Its purpose is to prove that the Specgate flow can
deliver a real application end-to-end — pack → `specops add` → bootstrap →
`harness run` per requirement. That purpose is served whether or not anyone
ever uses the resulting app. It keeps its own repo and its own lifecycle, and
nothing in this repository depends on it.

**Phase 4 of `visual-pack-authoring-todo.md` is closed, not deferred.** Its
recommendation — deliver through an existing surface rather than a new app —
is upheld. It was wrong only about *which* surface: a terminal command that
serves HTML turned out cheaper than a VS Code webview, and it works in any
editor, over SSH, and in CI.

## Consequences

**Positive:**

- One answer to "how do I look at this?", available wherever the CLI is.
- `specgate studio --json` is the same data the future agent contract (C3-02)
  needs, so the view and the machine surface do not diverge.
- The VS Code extension keeps its pack graph webview, which solves a different
  problem — authoring a `pack.yaml` — and is not a spec-tree viewer.

**Negative / accepted trade-offs:**

- A served HTML page cannot be as rich as a full SPA. Accepted: the cost of a
  second build pipeline, a second dependency tree and a second release train is
  not worth the polish, and the SPA was never funded as a product.
- `specgate studio` is read-only. Editing a pack through a UI remains out of scope;
  `specgate req` covers the mutation people actually asked for, from the terminal.
- The dogfood experiment's own requirements (REQ-001..015 in `specgate-studio-app`)
  overlap with what `specgate studio` does. That duplication is deliberate — the
  point of the exercise is the process, not the artefact.

## Rejected alternatives

- **Build the SPA as the product.** Rejected: it needs a hosting story, a
  release train and a dependency tree, for a view the CLI can serve in 300
  lines with none of that.
- **Deliver through the VS Code webview**, as Phase 4 originally proposed.
  Rejected: it locks the feature to one editor, and the extension already has a
  distinct job (authoring `pack.yaml`).
- **Kill the dogfood experiment.** Rejected: it is the only end-to-end test of
  the whole delivery flow this project has, and its value is independent of
  whether the app is ever used.

## References

- `mejoras/visual-pack-authoring-todo.md` — Phase 4, closed by this ADR. _(Document removed 2026-08-16; it is in git history.)_
- `mejoras/specgate-studio-brief.md`, `mejoras/specgate-studio-handoff.md`
- `scripts/studio.ts`
- `mejoras/plan-cierre-enterprise.md` — C1-07 (this decision), C8-01 (the experiment)
