# ADR-0012 — `plan` + `done`: closing the pack→code implementation loop

## Status

Accepted — 2026-05-13

## Context

The CLI already lets users **bring specs into a project** (`expand`,
`specops sync`) and **block merges when specs and code drift apart**
(`validate --strict-tdd`). What it did **not** offer was a structured answer
to the question every consumer (human or AI) asks right after `specops sync`:

> Three new `.feature` files landed in `features/`. **Which one should I
> implement first, and where do I put the code?**

Today the workflow is:

1. Read `git diff` after `sync`.
2. Open each new `.feature` by hand.
3. Cross-reference the row in `traceability.md` to recover the planned
   technical / test artifact paths.
4. Implement the test → implement the code → manually edit
   `traceability.md` to flip the `Status` cell from `Draft` to
   `Implemented`.

That is workable for a careful human, but it is **noise** for an AI
agent (which has to parse free-form text) and **error-prone for the
human** (the matrix often stays at `Draft` long after the code lands,
breaking audit trails).

## Decision

Ship three small, composable commands that close the loop:

1. **`plan`** — read `docs/specs/traceability.md` plus the filesystem
   and emit a bucketed report:
   - `NEEDS_FEATURE`, `NEEDS_EVERYTHING`, `NEEDS_TEST`,
     `NEEDS_IMPLEMENTATION`, `NEEDS_STATUS_UPDATE`, `DONE`.
   - Default output is colourised text.
   - `--format json` emits a stable structure for AI agents, editors,
     and CI dashboards.

2. **`done <REQ-id>`** — update the matching row in
   `traceability.md` to a terminal status (default: `Implemented`).
   - `--status` overrides the target status.
   - `--check` re-runs `validate` before writing; aborts on failure so
     the matrix never moves ahead of the gates.

3. **`specops diff --format json` (alias `--plan`)** — the existing
   `diff` already enumerates added/modified files; we add a
   machine-readable mode so an agent can react to a pack version bump
   without parsing text.

We **also** mirror these in the MCP server as `plan` and
`mark_requirement_done`, so MCP-aware AI clients (Claude Desktop,
Cursor, Aider) can drive the same loop natively.

## Rationale

- `plan` is **pure read** — fully cacheable, fully testable, and a
  natural fit for an MCP tool. It reuses the traceability matrix as
  the single source of truth: no separate state file, no drift.
- `done` is **a minimal, surgical edit** — one cell, with the same
  allow-list `validate` already enforces. Adding it as a CLI command
  (rather than asking agents to do markdown surgery) makes the change
  reviewable in a single git diff.
- The `--format json` + `--plan` aliases keep the existing text UX
  intact while opening a stable contract for tooling.
- Bucketing by what's *missing* (test vs code vs status) matches the
  way both human and AI workflows think about "what's next" — and it
  gives `--strict-tdd` a positive counterpart instead of just blocking.

## Alternatives considered

1. **Embed all of this into `validate --strict-tdd`.** Rejected: the
   gate's job is to block; mixing planning into it conflates "what's
   wrong" with "what to do next" and produces hostile error messages.

2. **Generate GitHub issues automatically after `sync`.** Considered
   for a follow-up. It is opinionated (GitHub-only), surface-heavy
   (needs auth, rate limits, idempotency), and tangential to the core
   ergonomic gap. We will revisit when the registry/GitHub App work
   lands.

3. **Auto-bump status when the test passes (no `done` command).**
   Rejected for v1: detecting "the test passes for *this* REQ"
   requires per-pack/per-stack runner knowledge we do not have. An
   explicit `done` keeps the contract clear and the audit trail
   deliberate.

## Consequences

### Positive

- AI agents can call `plan` → know exactly what to implement → call
  `mark_requirement_done` when finished. No text parsing.
- Humans get a colourised "to-do list" that matches their mental
  model after a pack sync.
- The traceability matrix becomes a *living* artifact instead of a
  rear-view mirror that has to be updated by hand.
- `validate --strict-tdd` and `plan` are now complementary: one
  blocks, the other guides.

### Negative / trade-offs

- The status update is still *trust-based* — `done` will mark a row
  Implemented even if the test does not actually pass, unless the
  user passes `--check`. We expect CI to enforce `validate
  --strict-tdd` as the real backstop.
- We now have two ways to write a status (`done` and direct markdown
  edit). We accept the redundancy — direct edits remain valid; `done`
  is the recommended, auditable path.

## Follow-ups

- `specgate watch` mode that re-runs `plan` on every save.
- A `done --auto` mode that runs the project's test command for the
  specific REQ and bumps the status only on green.
- A future `specops` command (`specops add`/`specops remove`) that
  changes the lockfile so `plan` and `done` close a fully scripted
  loop without manual markdown editing.

## References

- `scripts/plan.ts`
- `scripts/done.ts`
- `packages/mcp-spec-driven/src/tools.ts` — `plan` + `mark_requirement_done`
- ADR-0010 — specops sync/diff (M2)
- ADR-0011 — contracts pack + `--strict-tdd` gate (M3)
