# ADR-0013 — `harness run`: the spec-driven delivery loop for AI agents

## Status

Accepted — 2026-05-14

## Context

After ADR-0012 the CLI exposes every _piece_ an AI coding agent needs to
implement a requirement:

- `plan --format json` — the task queue.
- the feature file + `AI_RULES.md` — the per-task context.
- `validate --strict-tdd` + the project test command — the reward signal.
- `done REQ-NNN` — the state transition.
- the MCP tools — vendor-neutral access.

What was missing is the **orchestration layer**: the loop that runs
plan → context → agent → verify → done without a human copy-pasting
prompts between a terminal and a chat window. That gap is exactly what
"harness engineering" names — and it reframes the product from "a
scaffolder" to "a spec-driven delivery harness for AI agents".

It is a milestone, not a sprint: it touches git worktrees, subprocess
management, retries, timeouts and prompt templating. It also has a hard
prerequisite — conflict detection (ADR pending / `specops sync` M3) — so
that agent edits and a `specops sync` cannot silently corrupt a checkout.

## Decision

Ship `specgate harness run`. For each pending requirement from
`plan --format json`, in an isolated `git worktree` on a fresh
`harness/REQ-NNN` branch:

1. **Build a self-contained prompt** (`scripts/harness/prompt.ts`) —
   Gherkin scenario, `AI_RULES.md`, the exact artifact paths, the `plan`
   hint, and on a retry the previous gate failure. An agent gets no
   conversation history, so everything must be in the text.
2. **Shell out to the configured agent.** The agent is _any_ command
   containing the `{prompt_file}` placeholder; the harness writes the
   prompt to a temp file and substitutes the path. No built-in agent
   runtime, no SDK dependency.
3. **Gate it** — `validate --strict-tdd`, then the optional project test
   command. Both must exit zero.
4. **Green → `done REQ-NNN` + commit** on the branch. **Red → retry** up
   to `--max-attempts`, feeding the specific failure back into the prompt.
5. **Emit a pass/fail/attempts report** (text or `--format json`); exit
   non-zero if any requirement did not pass.

Settings (`agent`, `test_cmd`, `max_attempts`) may live in
`harness.config.yaml`; CLI flags override the file.

## Rationale

- **Worktree per requirement** is the isolation unit. A failed REQ leaves
  an inspectable branch, not a corrupted main checkout; concurrent or
  half-finished work cannot leak between requirements; the main working
  tree is never touched (the harness refuses a dirty tree).
- **Shell-out, not an SDK.** The product's value is being vendor-neutral.
  Coupling to one agent (or building a bespoke agent runtime) would throw
  that away. A configurable command + exit code + gate result is enough.
- **The harness never merges.** Integration stays a human decision. The
  harness produces reviewable branches; it does not push to `main`.
- **Retries feed back the _specific_ failure**, not a generic "try
  again" — the gate output is the highest-signal context a second
  attempt can get.
- **The gate is the reward signal, and it is only as strong as the
  pack's scenarios.** This is why hardening `pack lint` to flag vague
  scenarios matters more than pack-authoring ergonomics: without good
  scenarios the harness amplifies weak code.

## Alternatives considered

1. **Run in-place on branches, no worktree.** Simpler, but dirties the
   working tree, serialises badly, and a crashing agent leaves the main
   checkout in an unknown state. Rejected — isolation is the point.
2. **No git isolation, one commit per REQ on the current branch.** Fine
   for a demo, unacceptable as the product thesis: one bad REQ corrupts
   the run. Rejected.
3. **Pass the prompt over stdin.** Some agents do not read stdin, and it
   makes the `--agent` template less obvious. The `{prompt_file}`
   placeholder is explicit and works for every agent shape.
4. **Inline `{prompt}` substitution.** Shell-escaping hazard and shell
   length limits on large prompts. Rejected in favour of a temp file.
5. **Build an agent runtime / embed an SDK.** Rejected — kills vendor
   neutrality, the core differentiator.

## Consequences

### Positive

- Repositions the product from scaffolder to **spec-driven delivery
  harness** — the natural milestone after `plan`/`done`.
- A spec-driven repo becomes a turn-key environment for _any_ agent.
- Failures are contained and inspectable; successes are reviewable
  branches.

### Negative / trade-offs

- The reward signal is only as good as the pack's tests — weak scenarios
  let weak code through. Mitigation: harden `pack lint` (separate track).
- `git` and a git repo are hard requirements.
- The harness shells out to a user-supplied command; that command runs
  with the user's privileges in a worktree. This is the same trust model
  as any build script, but it is worth stating explicitly.
- Cost/time scale with `--max-attempts` × pending requirements. The
  per-invocation `--timeout` bounds a hung agent but not total spend.

## Follow-ups

- `harness run --merge` (opt-in) to fast-forward green branches once a
  team trusts the loop.
- Parallel worktree execution behind a `--jobs N` flag.
- Per-requirement cost/token accounting in the JSON report.
- Expose the loop as an MCP tool so an MCP-native agent can self-drive.

## References

- `scripts/harness/run.ts` — orchestrator
- `scripts/harness/prompt.ts` — prompt builder
- `scripts/harness/config.ts` — `harness.config.yaml` reader
- `docs/specs/harness.md` — user-facing guide
- ADR-0012 — `plan` + `done` (M4)
- ADR-0010 — specops sync/diff (M2)
