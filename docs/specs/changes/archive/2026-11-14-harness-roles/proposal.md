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
- REQ-534: the default protected paths grow to the agent's own
  instructions (`CLAUDE.md`, `.claude/`, `.cursor/`, `.github/`, `.mcp.json`).
- REQ-535: `max_cost_usd` per requirement, from the agent's reported usage.

Out of scope:

- An LLM auditor that decides `Tested`: the gate stays the judge. The
  existing `builtin:review` remains advisory.
- What already exists, found while implementing: the andon cord is REQ-189,
  REQ-494 and REQ-495 (`specgate ask` stops the requirement until answered);
  the outcomes are `pass`, `fail`, `skipped`, `blocked` and `question`; and
  `harness report` already gives the first-attempt rate. REQ-536 and REQ-537,
  reserved for them, are withdrawn.

## Approach

The harness loop keeps one worktree per requirement; a role is a second agent
invocation in that worktree with its own prompt template under
`templates/harness/`. Lanes are a diff filter run after each role, using the
test-file conventions of the derived matrix. Protection extends the existing
write-scope guard's default list. Cost is summed from the `cost` the events
stream already records for each session.
