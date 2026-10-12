# Harness — the spec-driven delivery loop

**Status:** Stable (M5 — `harness run`)
**Owner:** specgate
**Companion ADR:** [ADR-0013](./adr/0013-harness-run-loop.md)

A spec-driven repo is already a complete environment for an AI coding
agent — it just needs an orchestrator:

| Agent need       | Spec-driven repo provides                          |
| ---------------- | -------------------------------------------------- |
| Task queue       | `plan --format json`                               |
| Per-task context | the feature file + `AI_RULES.md`                   |
| Reward signal    | `validate --strict-tdd` + the project test command |
| State transition | `done REQ-NNN`                                     |

`specgate harness run` is that orchestrator. It runs **plan → context → agent
→ verify → done** for every pending requirement, with no human
copy-pasting prompts.

## TL;DR

```bash
specgate harness run --agent "claude -p < {prompt_file}" --test-cmd "npm test"
```

For each pending requirement, in an isolated `git worktree` on a fresh
`harness/REQ-NNN` branch:

1. Build a self-contained prompt — Gherkin scenario, `AI_RULES.md`, the
   exact artifact paths, and (on a retry) the previous gate failure.
2. Shell out to the configured agent.
3. Gate it: `validate --strict-tdd`, then the project test command.
4. Green → `done REQ-NNN` + commit on the branch. Red → retry up to
   `--max-attempts`, feeding the specific failure back into the prompt.
5. Emit a pass/fail/attempts report.

The harness **never merges a branch.** A human reviews `harness/*` and
merges what they trust.

## Why a worktree per requirement

Each requirement is implemented in its own `git worktree` cut from a
clean base. Consequences:

- The agent for REQ-002 cannot see or break REQ-001's half-finished work.
- A failed requirement leaves a `harness/REQ-NNN` branch you can inspect,
  not a corrupted main checkout.
- The main working tree is never touched — the harness refuses to start
  if it is dirty.

## Vendor neutrality

The agent is **any shell command** containing the `{prompt_file}`
placeholder. The harness writes the prompt to a temp file and substitutes
the path:

```bash
--agent "claude -p < {prompt_file}"
--agent "aider --yes --message-file {prompt_file}"
--agent "cursor-agent --prompt-file {prompt_file}"
--agent "my-wrapper.sh {prompt_file}"
```

There is no built-in agent runtime and no SDK dependency — the harness
shells out and reads the exit code plus the gate result.

## Flags

| Flag                    | Meaning                                                                     |
| ----------------------- | --------------------------------------------------------------------------- |
| `--agent <cmd>`         | Agent command; must contain `{prompt_file}`. Required (unless `--dry-run`). |
| `--test-cmd <cmd>`      | Project test command run as part of the gate. Optional.                     |
| `--max-attempts <n>`    | Retries per requirement, feeding back the failure (default 3).              |
| `--req <REQ-NNN>`       | Limit to specific requirement(s). Repeatable.                               |
| `--project-dir <path>`  | Project root (auto-detected from cwd if omitted).                           |
| `--base-branch <ref>`   | Branch/ref each worktree is cut from (default: current HEAD).               |
| `--timeout <seconds>`   | Per-agent-invocation timeout (default 600).                                 |
| `--keep-worktrees`      | Do not remove worktrees after each requirement.                             |
| `--force`               | Recreate `harness/REQ-NNN` branches that already exist.                     |
| `--format <text\|json>` | Report format (default text).                                               |
| `--dry-run`             | Build and print prompts; never invoke the agent or touch git.               |

`--agent`, `--test-cmd` and `--max-attempts` may also be set in
`harness.config.yaml` so they need not be retyped:

```yaml
harness_version: 1
agent: "claude -p < {prompt_file}"
test_cmd: "npm test"
max_attempts: 3

# Project-wide directives prepended to every per-REQ prompt — your Role,
# Active Project Boundary, Execution Policy. Use prompt_prefix for a
# one-liner; prompt_prefix_file for the realistic multi-line case
# (parseYamlLite has no block-scalar support).
prompt_prefix_file: ./.harness/prompt-prefix.md
```

CLI flags always override the file.

### `prompt_prefix` / `prompt_prefix_file`

The harness prompt is composed top-to-bottom as:

```text
[prompt_prefix or prompt_prefix_file]
---
# Implement REQ-NNN
## Requirement facts
## Suggested approach
## Gherkin scenario
## Project rules (AI_RULES.md inlined verbatim)
## Definition of done
## Previous attempt failed   (only on retries)
```

`prompt_prefix` is the natural home for the **Role / Active Project
Boundary / Execution Policy** directives that used to live in a
hand-crafted "base prompt" outside the harness. By moving them into
`harness.config.yaml`, they ride along on every REQ without duplication
and they version with the project.

When both keys are set, `prompt_prefix_file` wins.

## Inspect the prompt the harness will hand the agent

```bash
specgate harness prompt REQ-001
```

Friendly alias for `specgate harness run --dry-run --req REQ-001`. Prints the
exact prompt — prefix included — without invoking the agent, creating a
worktree, or touching git. Use it to iterate on `AI_RULES.md` /
`prompt_prefix`, or to copy-paste into a web AI when no CLI agent is
available.

Every prompt actually sent during `harness run` is also mirrored to
`.specops/harness-prompts/REQ-NNN-<timestamp>-attempt-N.md` in the
project for after-the-fact audit. Commit or gitignore that directory per
your team's preference.

## The gate

The reward signal is `validate --strict-tdd` followed by the optional
`--test-cmd`. Both must exit zero for a requirement to count as passed.

### Reading what the runner did, not what it printed

The gate's question has always been "did the command exit zero?", and both
silent holes this repository found live underneath it:

```
1 scenario (1 passed) · 0 steps · exit 0     a scenario with no steps
0 scenarios                     · exit 0     a filter that matched nothing
```

Measured: a harness run whose test command was `cucumber-js --tags
'@does-not-exist'` reported `1 passed`, published the branch and closed the
requirement.

When the message stream is available the gate reads it instead, and checks
that a scenario for the requirement exists, that it **ran**, that it had
steps, and that every one of them ended `PASSED` — plus how many scenarios
ran in total, which is the number `filterHint` used to infer with a regex
over prose.

Two ways in, and neither guesses:

```yaml
# harness.config.yaml — any runner, any command
message_report: .harness/cucumber.ndjson
```

or a **direct** `cucumber-js` invocation, which the harness appends
`--format message:<tmp>` to by itself. Deliberately narrow: `npm test` may
well run Cucumber and there is no way to know from here, so it is left
alone.

None of it is required. A project that does not use Cucumber keeps the
exit-code gate — a check that never applied must not fail anybody.

**The gate is only as strong as the pack's scenarios.** A pack with weak
or vague Gherkin lets the harness wave through weak code. Hardening
`pack lint` to flag vague scenarios therefore matters _more_ than authoring
ergonomics — it is what makes the harness an amplifier of good specs
rather than an amplifier of bad ones.

Those scenario rules now run here too, not only in `pack lint`: `specgate
validate --strict-scenarios` applies them to `features/**/*.feature`, and
`harness run` refuses a requirement whose scenario Cucumber would see as
empty **before** creating the worktree — an attempt costs `max_attempts` ×
the timeout, and there is no point buying that against a scenario that
cannot fail.

### Filtering by tag

`specgate expand` tags every scenario it generates with the requirement and
scenario it belongs to:

```gherkin
@REQ-001 @SCN-001
Scenario: Issuing an invoice emits InvoiceIssued
```

A tag survives a rename and a title does not, which matters here more than
anywhere: rewording a scenario is the one thing an agent does that turns the
gate green and empty. Filter on the tag rather than the name:

```bash
--test-cmd "npx cucumber-js --tags '@{req}'"
```

`{req}` and `{scenario}` are substituted per requirement, and the message
protocol check above already prefers tags when matching a scenario to the
requirement under test.

`specgate validate` uses the same tags to check the matrix points at a scenario
that exists — a file that carries no tags is left alone, so an adopted
repository is not failed for a link it was never given the means to make.

### Write scope

Before the gate runs, the harness checks what the agent actually wrote.
The prompt asks it not to touch the spec; that was never verified, and an
agent that cannot make a scenario pass can relax the scenario instead. A
measured run of exactly that reported `1 passed`, published the branch and
closed the requirement.

Protected by default:

```
spec.md            AI_RULES.md          features/**/*.feature
docs/specs/**      .specops.lock        harness.config.yaml
```

Touch one and the attempt fails with `agent_touched_protected_path`; the
diff of the offending paths is fed into the next attempt's prompt, because
the agent usually did it without meaning to and seeing the hunk is what
corrects it.

### The gate's own command is part of the contract

The list above is the specification. It is not the file that defines the
command the gate *runs*, and that gap was the same hole one level up: measured
with a stub agent that wrote no implementation at all and only replaced
`"test": "node --test tests/*.test.js"` with `"echo 'all good'"` over a red
suite, the harness reported `✅ pass (1 attempt)`. An agent that could not pass
the test could weaken the test.

So the attempt also fails with `agent_rewrote_gate_command` when the script the
gate command invokes is not the same before and after. The before and after go
back to the agent, like the write-scope diff does.

This does **not** protect the manifest. Adding a dependency mid-implementation
is legitimate, and a guard that blocked it would be switched off within a day —
at which point it protects nothing. Only the one script the gate names is
compared. `npm test`, `npm run <name>`, `yarn`, `pnpm` and `make <target>`
resolve to something readable; `mvn -B test`, `pytest` and `go test` do not,
and there the check reports that it did not look rather than that it passed.

**Creating a file that did not exist is not a violation.** A requirement in
category `NEEDS_FEATURE` is supposed to write its feature file, and git
already separates the two cases: untracked is new, a tracked change is an
edit. Deleting the declared feature and writing a fresh one shows up as a
deletion, and is refused.

Both lists are configurable, from the file only — a flag that widens what
the agent may edit is a flag somebody eventually types to turn a red run
green:

```yaml
protected_paths: # naming your own list replaces the defaults
  - "spec.md"
  - "features/**/*.feature"
allow_paths: # an explicit escape hatch, never a silent one
  - "features/legacy/**"
```

### Declared artifacts

After a **green** gate, the harness compares the diff with the paths the
matrix row declares as the requirement's test and production artifacts. An
agent can implement somewhere else, pass the scenario, and leave the row
pointing at a file where the logic does not live.

Missing → `declared_artifact_untouched`, a **warning** by default, an error
under `--strict-artifacts`. Warning, because work can legitimately land in
a shared module that already exists, and failing on that is the kind of
gate that rejects good work.

Only declarations that name a file are checked. A real matrix cell is
markdown written by a person — the scaffolded one says `` `API /health`,
smoke test `` and `TBD` — and comparing prose against a diff would warn on
every project, which is how a warning becomes noise people skip.

## Is the requirement ready for an agent?

`plan` has always known when a requirement's feature does not exist, its
dependencies are unmet, or its row is `Deprecated`. The harness never used
any of it as a filter, so the agent found out halfway through and the run
paid `max_attempts` × the timeout to discover it.

`specgate plan --format json` now carries `ready` and `blockers[]` per
requirement, each blocker with a `fix`:

| Check | Effect |
| --- | --- |
| The feature file exists | blocks |
| Its scenarios are ones Cucumber could fail | **always skips** |
| Dependencies are done | blocks |
| Status is not `Deprecated` | blocks |
| Status is not `Needs Clarification` | blocks |
| The row declares a test artifact | warns |
| The row declares a production artifact | warns |

"Blocks" means `harness run --skip-not-ready` will pass it over. Without
the flag the harness warns and runs it anyway: the default is unchanged,
and someone who wants to point an agent at a half-ready requirement may.

The scenario check is the exception and skips regardless of the flag. That
is not a preference — Cucumber passes an empty scenario, so the reward
signal is counterfeit and a green run would prove nothing (H14).

`Needs Clarification` blocks for a reason worth stating: an agent asked to
settle a disagreement settles it by guessing, and the guess arrives wearing
a green gate.

## An agent profile per requirement

`agent_profile` resolved one profile for the whole run, so an infrastructure
requirement and a domain one got the same prompt prefix and the same allowed
tools — and the allowances had to be the greatest common denominator of
everything in the plan.

A profile that declares `match:` selects itself instead:

```yaml
profiles:
  infra:
    agent: "claude -p --allowedTools Read Write Edit 'Bash(terraform:*)' < {prompt_file}"
    match: { bounded_context: Platform }
  domain:
    agent: "claude -p --allowedTools Read Write Edit 'Bash(npm:*)' < {prompt_file}"
    match: { bounded_context: "*" }
```

First match wins, so order in the file is the priority. No match uses the
run's default — that is not an error. A profile with **no** `match:` is not
a rule: it is chosen by name through `agent_profile`, and treating an absent
`match:` as "matches everything" would make the first profile in the file
swallow every requirement the moment somebody added a rule to another.

Matchable keys are `bounded_context`, `requirement`, `feature` and
`category`. `*` matches any value; an unknown key matches **nothing** rather
than being ignored, so `bounded_contex:` — one letter short — cannot quietly
become a rule that matches everything. A role named by `attempt_profiles`
still wins for its own step: a step that says which role it is has already
answered the question.

### Where the bounded context comes from

It is derived, not declared. Measured across the eleven curated packs: **no
scenario names an aggregate** — not directly, and not through its use case —
so matching on the bounded context would have matched nothing and used the
default every time.

The link exists one step further round. Use case → command → aggregate →
bounded context resolves for **all twenty-seven** scenarios, so `specgate expand`
follows it and records the result beside the matrix, by name rather than by
id:

```
<!-- specgate:trace REQ-002 depends=REQ-001 context=Payments -->
```

`Payments` is what a person writes in `match:`; `BC-002` is an identifier
they never chose. Same line as B1's `depends=`, because a trace line carries
keys and a second regular expression would have agreed with the first only
by luck.

## A ceiling on the run

`max_attempts` was the only limit. Fourteen requirements × 3 attempts ×
1200 s is hours of wall-clock and an unbounded bill — and the third real
run ended because the account hit its monthly limit, which is the expensive
way to find out there was no ceiling of our own.

```bash
specgate harness run --budget-seconds 3600 --max-requirements 5
```

Both are asked **before starting** each requirement, never in the middle of
one: interrupting an attempt in flight would throw away the money already
spent on it. A budget bounds what a run begins.

Exhausting one is not an error. The run ends the ordinary way, the
requirements it never started are reported as `skipped` with the reason,
and the ledger is still written — a run that dies halfway writes none, so
`specgate harness report` cannot say what the money bought.

Neither relaxes anything: every worktree that does run passes the same
gate.

### What a run costs, when a profile says so

The harness cannot see an agent's tokens — an agent is any shell command.
A profile may declare roughly what a run of it costs, and `harness report`
multiplies it out, labelled as declared rather than measured:

```yaml
# .harness/profiles.yaml
profiles:
  local-claude:
    agent: "claude -p < {prompt_file}"
    cost_per_run_hint: 0.35
```

Attempts by a profile with no hint are counted separately, so the total
never reads as complete when part of the run is missing from it.

## Resuming an interrupted run

An existing `harness/REQ-NNN` branch used to leave two options: skip it, or
delete it with `--force`. After a crash, a Ctrl-C or a spend limit, neither
is what you want — you either lose the work or cannot continue.

`--resume` re-attaches to the branch and, when it is still registered, to
the worktree holding the agent's uncommitted work, and picks up where the
run stopped. `--force` and `--resume` are refused together: they are
opposites, and quietly choosing one is how work gets deleted.

Where it picks up is read from the prompt archive, not from
`.harness/runs/`. The run ledger is written when a run *finishes*, so an
interrupted run leaves none — measured with `kill -9`, which leaves the
branch, the worktree, the archive, and an empty ledger.

Interrupted and exhausted get different answers, and the branch says which:

| Last run | Evidence | Resumes at |
| --- | --- | --- |
| Attempts exhausted | a `wip(…): FAILED the gate` commit | the next attempt |
| Interrupted | no such commit | the attempt that was cut short |

An attempt that was killed never reached a gate verdict, so nothing was
learned and the budget is not charged for it. The last failure the gate did
report is recovered from the archived prompt that carried it, so the
resumed attempt is not started blind.

## Retries

On a red gate, the harness captures the failing stage and its output,
appends it to the next prompt under "Previous attempt failed", and
re-invokes the agent in the same worktree. After `--max-attempts` the
requirement is **parked**: marked `fail` in the report, branch left for a
human to pick up.

## Report

```text
── harness report ──
  ✅ REQ-001  pass (1 attempt)   → harness/REQ-001
  ✅ REQ-002  pass (2 attempts)  → harness/REQ-002
  ❌ REQ-003  fail (3 attempts)  → harness/REQ-003
       Gate failed at: test command

  2 passed · 1 failed · 0 skipped
  Review and merge the harness/* branches you trust.
```

`--format json` emits the same data as a machine-readable structure for
CI dashboards. The command exits non-zero when any requirement did not
pass.

### `specgate harness report` — what it has cost, and whether the gate is any good

Reads the run ledger (`.harness/runs/*.json`) and answers four questions
the ledger alone does not:

- **where attempts end.** Counted per attempt, not per requirement: one
  that passed on attempt 3 still failed twice, and those two are the
  interesting ones. The stages include `write-scope` and `artifacts`, so an
  attempt rejected for editing the spec reads differently from one that
  failed its tests.
- **which requirements spent every attempt and delivered nothing** — the
  ones costing `max_attempts` × the timeout for no result.
- **the series over time**, so a rate can be seen moving rather than
  guessed at.
- **how many failures were real.**

That last one cannot be derived. A gate rejecting good work and a gate
catching a genuine defect look identical in the ledger; only somebody who
looked can say which happened. So it stays `—` until a person marks one:

```bash
specgate harness report --mark-false-failure REQ-002 \
  --reason "the shared module already implemented it; the row was wrong"
```

`--reason` is required — a number nobody can audit later is worse than an
honest blank. Marks are appended one JSON object per line to
`.harness/false-failures.jsonl`, which is what survives a process dying
mid-write, and a mark applies to the **requirement**, not to one run of it:
what a person is saying is "the gate was wrong about REQ-002".

## Limitations

- `git` must be on `PATH`; the project must be a git repository.
- The harness does not merge branches — integration is a human decision.
- A requirement whose `harness/REQ-NNN` branch already exists is skipped
  unless `--force` is passed (which deletes and recreates the branch).
