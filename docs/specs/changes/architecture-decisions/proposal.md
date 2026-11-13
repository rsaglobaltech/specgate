# Proposal: architecture-decisions

## Intent

AIUP records the technical frame the agent works in: ADRs that are superseded
rather than rewritten, a decision-rights file saying what the agent may decide
alone, and a stack file naming each layer, its build skill and its commands.
Its construction skills read all three. Specgate uses ADRs for its own
development but offers users no command for them, has no notion of what the
agent may not decide, and the harness learns a project's commands only from
`test_cmd` and friends.

## Scope

In scope:

- REQ-546: `specgate adr new|supersede|list` under `docs/specs/adr/`.
- REQ-547: `docs/specs/decision-rights.md` is given to the harness agent, and
  an attempt that adds a dependency the rights reserve fails with
  `decision_right_exceeded`.
- REQ-548: `specgate stack` detects the project's layers and commands into
  `docs/specs/stack.md`, which the harness and the gate read.

Out of scope:

- Per-technology construction skills (AIUP's layer plugins): the stack file
  is the contract they would plug into; writing them is a later change.

## Approach

ADR numbering reuses the zero-padded scheme of this repository's own
`docs/specs/adr/`. Decision rights are a Markdown table (decision, agent may,
ask) with a fixed set of machine-checked decisions — new dependency, new
database migration, public API change — read from the diff of manifests,
migration folders and OpenAPI files. `stack` reuses the detection `adopt` and
`ci init` already do.
