<!-- specgate:allow-placeholders -->

# The harness

The harness delivers requirements unattended and stops when the gate says no.
It sits between an archived specification and a person who merges.

<!-- specgate:diagram lifecycle -->

## One turn, in sequence

<!-- specgate:diagram harness-loop -->

Each pending requirement (or the one `--req` names) gets a fresh worktree on
`harness/REQ-NNN` and a prompt built from its Gherkin. The gate is
`validate --strict`, an untouched specification, then your tests. Green marks
it done on its branch; red feeds the failures into the next attempt, up to
`max_attempts`, and after the last one the work is kept as a `wip(REQ-NNN):
FAILED the gate` commit with the requirement still `Draft`. A requirement
waiting for an answer is refused. Nothing is ever merged.

## Set it up

```bash
specgate harness init
```

Writes `harness.config.yaml` and `.harness/prompt-prefix.md`, detects the gate
from your build files, and leaves `agent:` unset — which agent runs the loop is
your choice and your credentials.

Name the agent when you run it:

```bash
specgate harness run --req REQ-001 \
  --agent "claude -p --allowedTools Read Write Edit Glob Grep 'Bash(npm:*)' < {prompt_file}"
```

**The tool allowances matter.** An agent in non-interactive mode has no way to
ask permission, so without them it reads the prompt, cannot write a file, and
the attempt is wasted. Scope them rather than reaching for
`--dangerously-skip-permissions`: the agent needs `Bash` to run the project's
build, and `Bash(npm:*)` is enough for a Node project. It works in a throwaway
git worktree, which is the whole reason the harness uses one.

Other agents take the prompt differently — `aider --yes --message-file
{prompt_file}`, `opencode run "$(cat {prompt_file})"`. The harness only requires
that the command contain `{prompt_file}`.

A tool that fits none of those shapes needs a wrapper, and a command **without**
`{prompt_file}` is refused rather than silently run.
→ [Choosing and wiring your agent](agent-setup.md) covers both, with the
commands for the tools people actually use.

**The agent works in a fresh worktree, which carries only what git tracks** — no
`node_modules`, no `target/`, no `.venv`. An agent must not spend its attempt
installing dependencies, so the harness does it first: `setup_cmd:`,
`--setup-cmd`, or else what the lockfile implies (`npm ci`, pnpm, yarn);
`--setup-cmd none` runs nothing. The agent gets `SPECGATE_REQ` and
`SPECGATE_ATTEMPT` in its environment.

Or commit the commands your team uses and pick one by name:

```yaml
# harness.config.yaml
agent_profile: local-claude

# .harness/profiles.yaml
profiles_version: 1
profiles:
  local-claude:
    agent: "claude -p < {prompt_file}"
  ci:
    agent: "aider --yes --message-file {prompt_file}"
```

Write profiles in block form, as above: the reader is a dependency-free YAML
subset, and an inline mapping (`local-claude: { agent: "…" }`) parses as a
_string_, leaving the profile with no `agent`.

A profile may also declare `match:` and select itself, so one run gives
different requirements different agents — and different tool allowances —
rather than the greatest common denominator of the whole plan.
→ [A profile per requirement](specs/harness.md)

## Parallel branches and the traceability matrix

**A generated matrix** (the default) never blocks a merge: it is declared
`merge=union` in `.gitattributes`, git keeps both sides' rows, and `specgate
check` regenerates it ([ADR-0036](specs/adr/0036-a-gate-a-team-can-trust.md)).
**A hand-kept matrix**, where a duplicated row is corruption, uses the
row-wise driver below.

Every harness branch flips its own row in `docs/specs/traceability.md`. Git
merges by lines and needs an unchanged line between two changed regions to treat
them as independent — and matrix rows are consecutive lines. So two branches
that touched **different** requirements still collide, purely because their rows
are neighbours. Measured on a three-requirement project: rows 1 and 2 conflict,
rows 1 and 5 merge clean.

`specgate harness init` sets up a merge driver that merges the matrix by row instead
of by line:

```bash
specgate harness init --project-dir .   # writes .gitattributes, registers the driver
git add .gitattributes && git commit -m "merge the matrix by row"
```

It still **conflicts** when two branches set the _same_ row to different
values: discarding somebody's decision is worse than asking.

**Every clone registers it once.** `.gitattributes` is committed, but
`merge.specgate-matrix.driver` is local git config that nothing can commit, so a
fresh checkout and every CI job needs `specgate harness init` too. Until then git
falls back to its built-in merge — the conflict the project had before, never a
silently wrong result — and `specgate doctor` reports the gap.

### Resolving one by hand

When two branches really did change the same row, the file gets git's usual
markers around that one row:

```
<<<<<<< ours
| REQ-002 | SCN-002 | … | Implemented |
=======
| REQ-002 | SCN-002 | … | Verified |
>>>>>>> theirs
```

Keep exactly one of the two lines and delete the three marker lines. **Never
keep both:** a duplicated requirement is the one corruption this file must not
have — it is also what `merge=union` produces, which is why a hand-kept matrix
uses the row-wise driver instead. Then run `specgate validate .`, which checks the statuses are
legal and that no scenario id repeats.

## A chain of requirements, merged as they pass

```bash
specgate harness run --chain --req REQ-002 --req REQ-003   # on develop
```

One requirement at a time, in order, each cut from the previous merge. A green
one is merged into the branch you are on (a merge commit; its prompts stay on
its `harness/` branch) and **the gate runs again on the merge**; a red result
is undone and the chain stops. Without `--chain` the harness never merges.

**Watch it work**: `specgate studio`, then `/live` — attempts, phases, files,
tests and steps as they happen, from `.harness/events/` (git-ignored). Claude
Code reports its steps through `… --output-format stream-json --verbose |
specgate harness events --from claude`.

## Change agent between attempts

Three attempts with the same agent, the same model and only a different prompt
is mostly a re-roll. A ladder gives each attempt its own profile, and can put an
advisory reviewer in front of every retry:

```yaml
# harness.config.yaml
attempt_profiles:
  - implementer # attempt 1
  - repairer # attempt 2
  - repairer-strong # attempt 3, and any beyond it
review_profile: reviewer

# .harness/profiles.yaml
profiles:
  implementer:
    agent: "claude -p < {prompt_file}"
  repairer:
    agent: "claude -p < {prompt_file}"
  repairer-strong:
    agent: "claude --model opus -p < {prompt_file}"
  reviewer:
    agent: "claude -p < {prompt_file}"
    advisory: true
```

A ladder shorter than `max_attempts` reuses its last rung. Declaring neither key
keeps exactly the behaviour you have today: one agent, every attempt.

**The reviewer advises; it never approves.** It runs before each retry — never
before the first attempt, since there is nothing to review yet — and its output
is added to the next prompt as findings. Then everything it touched in the
worktree is discarded, so it cannot reach the gate even if it tries to write
code. `validate --strict` plus your test command stay the only judge, and a
finding with the gate green does not block anything.

A profile named by `review_profile` must declare `advisory: true`. Without it
the harness refuses to start, because a reviewer whose work _was_ gated and
committed is not a reviewer.

Every agent is still bound to exactly one requirement: an attempt may run two
roles, but both work on the same REQ, in the same worktree, against the same
gate. `.harness/runs/<ts>.json` names the roles that ran each attempt, and the
branch carries one archived prompt per role — `attempt-2-reviewer.md`,
`attempt-2-implementer.md` — so a reviewer can see exactly what each was asked.

## Run more than one requirement at a time

```bash
specgate harness run --concurrency 4
```

**Only requirements that do not depend on each other ever run together.** The
harness reads the dependency graph — the `depends=` keys in each requirement's
`specgate:trace` comment — and processes the queue in levels: everything in a level
is independent, so it can go out to the pool at once; the next level waits.

**A failure blocks what waits on it; it does not fail it.** Before dependencies
were expressible, one broken predecessor produced a failure for every
requirement behind it — N failures for one cause, and N agent invocations paid
for work that could not have succeeded. Now the report says so:

```
  ❌ REQ-001  fail (1 attempt)     → harness/REQ-001
  ⛔ REQ-002  blocked (0 attempts) → harness/REQ-002
       Not attempted: REQ-001 did not pass.

  0 passed · 1 failed · 0 skipped · 1 blocked
```

A requirement caught in a dependency cycle is reported the same way and never
attempted; `specgate validate` is what explains the cycle and how to break it.

**The base is derived, not passed.** A requirement is cut from the branch of
the dependency it builds on, because that is the only place its code exists
during a run. Nobody has to know the order and pass `--base-branch` by hand —
which used to cost a whole agent run when the base turned out to be missing a
fix that had landed on `main`. The harness now says so when it happens:

```
⚠️  REQ-002: base harness/REQ-001 is 3 commit(s) behind main.
    A fix that landed on main is not in this worktree —
    a gate failure may not be about REQ-002.
```

**A requirement with several dependencies gets them merged.** Their branches
know nothing of each other, so cutting from one would silently omit the rest.
The harness assembles a throwaway `harness/base/REQ-NNN` first. Two things
worth knowing about it:

- It resolves conflicts in `docs/specs/traceability.md` by keeping the base's
  version. Sibling branches _always_ conflict there — each run ends with `specgate
done`, editing the same table — and the integration base exists only so the
  agent can see code. Each real `harness/REQ-NNN` branch keeps its own row.
- A conflict in an actual source file blocks the requirement and names the
  file. That is a genuine finding: two dependencies changed the same code in
  incompatible ways, and no automatic answer would be right.

This is not the merge the harness refuses to do. That one is into a branch a
human reviews; this one assembles the context a requirement was declared to
need, and it is thrown away afterwards.

**The default is 1, deliberately.** Two reasons, and neither is timidity:

- Every step of a requirement — the gate, the agent, `specgate done`, git — is a
  blocking call, so above 1 each requirement runs in a worker process. That
  path is newer than the serial one, which has years of real agent runs behind
  it.
- Parallelism moves the bottleneck rather than removing it. Four green branches
  are four reviews, and the harness still never merges.

`concurrency: 4` in `harness.config.yaml` sets it for the project.

## What the harness has cost

`specgate harness report` reads every recorded run and prints two numbers: how
often the first attempt worked, and the wall-clock cost per delivered
requirement. → [What the harness has cost](harness-report.md)

## When a run fails

The report prints the tail of the gate output and the command that failed.
Some failures end it after one attempt: [when retrying cannot help](troubleshooting.md#when-another-attempt-cannot-help).

The attempt is **committed on the branch** with a `wip(REQ-NNN): FAILED the
gate` subject, so the agent's work is there to read instead of discarded. The
requirement stays `Draft`, because `specgate done` never ran.

```bash
specgate harness run --req REQ-002 --format json      # the whole gate output
specgate harness run --req REQ-002 --keep-worktrees   # reproduce it in place
```

**A requirement that builds on another** runs with `--chain`, or with
`--base-branch harness/REQ-001`. That branch also supplies the project
configuration, so a fix committed to `main` reaches a stacked run only once the
base has it — check the gate command the report prints.

---

## Next

- [Automation](automation.md)
- [The harness spec](specs/harness.md)
- [Command reference](commands.md)
