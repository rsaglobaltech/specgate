# ADR-0031 — AGENTS.md is the agent contract; AI_RULES.md folds into it

## Status

Accepted — 2026-10-09

## Context

A Specgate project carries two files an agent is meant to read:

- **`AI_RULES.md`**, written by `init`/`adopt` from a per-stack template
  (27–56 lines): the agent's role, the stack's rules, what it must never do,
  the domain-modelling rules.
- **`AGENTS.md`**, written by `agents init` for Claude Code and Codex: the
  non-negotiables again, and the daily loop step by step — over 60 lines.

They overlap, they drift, and only one of them is a convention anyone else
knows. `AGENTS.md` is the file the market settled on: around twenty agents
read it by name — OpenAI Codex, Cursor, GitHub Copilot, Google Jules, Aider,
Windsurf, Zed, Amp among them — and it is now a Linux Foundation standard
(checked 2026-10-09). `AI_RULES.md` is read only because Specgate's generated
files point at it. The
simplification plan (phase 2) asks for one short contract; the team asked to
keep to the market standard.

## Decision

**`AGENTS.md` is the one agent contract. `init` and `adopt` write it;
`AI_RULES.md` is no longer written, and its content moves into `AGENTS.md`.**

1. **Short by rule.** The generated `AGENTS.md` is at most 60 lines, and a
   test keeps it so. It holds what an agent needs on every turn — what the
   project is, the commands (test, gate, next), the loop in four lines, what
   it must never do — and a `## Project rules` section for the stack's and
   the team's own rules. The detail of each step lives in the `/specgate:*`
   commands and in `specgate change instructions`, which the engine answers.
2. **Readers accept both.** Everything that read `AI_RULES.md` — the agent
   prompt, `change instructions`, `validate`, `doctor`, the harness — reads
   `AGENTS.md` first and `AI_RULES.md` when it is the only one. A project that
   has not migrated keeps working, unchanged.
3. **Both are protected.** The write-scope guard covers `AGENTS.md` as it
   covers `AI_RULES.md`: an agent may not rewrite the contract it is judged by.
4. **Migration is `specgate update`.** It writes `AGENTS.md` with the
   generated contract and moves the existing `AI_RULES.md` content, verbatim,
   under `## Project rules (from AI_RULES.md)`, then removes `AI_RULES.md`.
   `--dry-run` shows it first. When `AGENTS.md` already exists and was not
   written by Specgate, the team's text is kept and the generated part is
   added above it, never replacing it. Git keeps the old file.
5. **`agents init` stops duplicating it.** For Claude Code and Codex it writes
   the same contract; on a project `init` already set up, the file exists and
   is left alone.

## Consequences

- One file to read, in the place every agent looks.
- Templates: one `templates/base/AGENTS.md.tpl` for every project type, with
  each type's rules — one line per rule, none dropped — in
  `templates/<type>/stack-rules.md`. Generated sizes: backend and frontend 36
  lines, mobile 41 (`tactical-ddd`, the default profile, with its checks).
- Packs that render an `AI_RULES.md` (the contracts pack does) keep doing so;
  it is read as a legacy rules file, alongside `AGENTS.md`. Moving a pack's
  rules into a team's `AGENTS.md` would mean `expand` writing into a file the
  team owns, which this decision forbids.
- Measured on the Golden State app: `specgate update` folded its 28-line
  `AI_RULES.md` under the block, replaced the `AGENTS.md` an older Specgate had
  generated, and left a 58-line `AGENTS.md`; `validate --strict` stayed green.
- Tests and docs that name `AI_RULES.md` move to `AGENTS.md`; the ones that
  test a legacy project keep `AI_RULES.md` on purpose.
- A team that edited `AI_RULES.md` loses nothing: the text moves, and the
  migration is a reviewable diff.

## Alternatives considered

- **Keep both, point one at the other.** The current state; two files drift.
- **Keep `AI_RULES.md` as the name.** A convention of one tool.
- **Write `AGENTS.md` and leave `AI_RULES.md` in place.** Two contracts that
  disagree is worse than either alone.

## References

- `mejoras/plan-simplificacion-equipo.md` — phase 2
- ADR-0017 — The agent JSON contract; ADR-0022 — Patterns are optional
