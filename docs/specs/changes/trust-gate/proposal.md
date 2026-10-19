# Proposal: trust-gate

## Intent

Milestone M2 — trust the gate. Building agentkit (118 requirements) with
Specgate, the gate was right about the code and wrong about the text: it
refused a command in a code span as an unfilled placeholder, and demanded a
matrix row for every id a sentence mentioned. Two branches could hand out
the same id; the generated matrix conflicted on every parallel merge; and the
harness needed four wrapper scripts to install dependencies, keep prompts out
of commits, tell the agent its requirement, and merge a sequence of green
requirements without leaving the base red.

A gate people learn to work around is a gate they stop trusting. This change
removes each of those reasons. Decision record:
[ADR-0036](../../adr/0036-a-gate-a-team-can-trust.md).

## Scope

In scope:

- Placeholder and vague-step rules ignore code spans and quoted text (REQ-117).
- TDD-3 counts declared requirements only (REQ-118), with a real project's
  specification as a regression corpus (REQ-119).
- `id_taken_on_base` in `check` (REQ-120); allocators skip open changes'
  reserved ranges (REQ-121).
- The generated matrix merges with git's `union` driver; `check` regenerates
  it (REQ-122).
- Harness: setup detected from the lockfile (REQ-123), prompts kept out of
  the base branch (REQ-124), `SPECGATE_REQ`/`SPECGATE_ATTEMPT` for the agent (REQ-125),
  `--chain` merging only on a green gate, also after the merge (REQ-126,
  REQ-127).

Out of scope:

- Renumbering ids automatically (RequirementRemoval explains why ids are not
  rewritten once they are in tests, tags and commits).
- A built-in Claude Code agent preset and the live harness view (M4).

## Approach

Each item is local to the module that owns the rule. `--chain` is opt-in: the
harness keeps never merging unless asked.
