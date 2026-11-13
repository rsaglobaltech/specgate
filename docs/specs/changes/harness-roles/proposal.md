# Proposal: harness-roles

## Intent

The harness gives a requirement to one agent, which writes both the code and
the tests that judge it, and retries up to `max_attempts`. AIUP's Werkstatt
splits the work: an implementer, a tester and an auditor, each in its own
session, with lanes — the implementer cannot touch tests, the tester cannot
touch production code — a cost budget per use case, a checksum on the files
that steer the agent, and an "andon cord" that stops a use case when the agent
finds a gap in the spec. It also reports a first-pass rate, which tells a team
whether its problems lie in the spec or in the harness. Our gate is stronger;
our harness lets one agent grade its own work.

## Scope

In scope:

- REQ-532: `roles:` in `harness.config.yaml` runs implementer and tester as
  separate agent sessions; the tester gets the requirement, not the
  implementer's output.
- REQ-533: lanes — test files the implementer writes and production files the
  tester writes are reverted and reported.
- REQ-534: protected paths — the specification and the agent instructions
  (`.claude/`, `.github/`, `AGENTS.md`, `CLAUDE.md`, `.mcp.json`) are
  checksummed; an attempt that changes them ends `stuck`.
- REQ-535: `max_cost_usd` per requirement, from the agent's reported usage.
- REQ-536: every requirement ends `ready`, `blocked`, `stuck`, `pending` or
  `skipped`, and `harness report` gives the first-pass rate.
- REQ-537: andon — a blocking question the agent writes stops the
  requirement at `Needs Clarification`, and only the question is kept.

Out of scope:

- An LLM auditor that decides `Tested`: the gate stays the judge. The
  existing `builtin:review` remains advisory.

## Approach

The harness loop keeps one worktree per requirement; a role is a second agent
invocation in that worktree with its own prompt template under
`templates/harness/`. Lanes are a diff filter run after each role, using the
same test-path patterns `apply` uses to find tests. Checksums are taken before
the first role and compared after each. Cost is summed from each session's
usage, as `agent ask` already reads it.
