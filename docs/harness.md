<!-- specgate:allow-placeholders -->

# The harness

The **harness** delivers requirements unattended: it gives each pending
requirement to a coding agent, runs the gate on the result, and stops when the
gate says no. At the end of this page you can run it on one requirement, chain
several onto a branch, run them in parallel, and read a failure.

**You need:** a project where `specgate init` has run, git, a test command
(`specgate config set test_cmd "npm test"`) and a coding agent you can run from
the command line. Which agent, and how to call it, is on
[Choosing and wiring your agent](agent-setup.md).

<!-- specgate:diagram lifecycle -->

## One turn, in sequence

<!-- specgate:diagram harness-loop -->

1. Each pending requirement (or the one `--req` names) gets a fresh git
   worktree on a branch called `harness/REQ-NNN`.
2. The harness installs the project's dependencies in it, then gives the agent
   a prompt built from the requirement and its Gherkin scenario.
3. The gate runs: `validate --strict`, a check that the agent did not edit the
   specification, your architecture check, your tests, then your
   [quality checks](quality.md) — coverage of the lines it added, mutation,
   SAST, secrets, Conventional Commits.
4. **Green:** `specgate apply` marks the requirement Implemented and the work
   is committed on its branch as `feat(REQ-NNN): …`.
5. **Red:** the failures go into the next attempt, up to `max_attempts`
   (default 3). After the last one the work is committed as
   `chore(REQ-NNN): attempt FAILED the gate` and the requirement keeps its status.

A requirement that waits for an answer (Needs Clarification) is refused.
Without `--chain`, nothing is merged: each green requirement waits on its own
branch for review.

## Set it up

```bash
specgate harness init
```

This writes `harness.config.yaml` and `.harness/prompt-prefix.md`, detects the
test command from your build files, and leaves `agent:` unset: which agent runs
and with which credentials is your choice. Then name the agent and run one
requirement:

```bash
specgate harness run --req REQ-001 \
  --agent "claude -p --allowedTools Read Write Edit Glob Grep 'Bash(npm:*)' < {prompt_file}"
```

The harness writes the prompt to a temporary file and puts its path where
`{prompt_file}` stands. A command without the placeholder is refused. The tool
allowances, the commands for other agents and team profiles are on
[Choosing and wiring your agent](agent-setup.md).

With several agents in `.harness/profiles.yaml`, `--profile <name>` picks one
for this run (`propose --from-brief` takes it too), and the
[studio](studio.md)'s Build page offers the same choice.

To see what would happen without paying for an agent:

```bash
specgate harness prompt REQ-001      # the exact prompt, printed
specgate harness run --dry-run       # what it would do, in order
```

## The worktree

Each requirement runs in its own git worktree, so the agent never touches your
working copy. A fresh worktree holds only what git tracks: no `node_modules`,
no `target/`, no `.venv`. Before the agent starts, the harness runs the setup
command: `setup_cmd:` in `harness.config.yaml`, `--setup-cmd`, or the install
your lockfile implies (`npm ci`, pnpm, yarn). `--setup-cmd none` runs nothing.
See [Dependencies](agent-setup.md#dependencies-the-setup-command).

The agent gets `SPECGATE_REQ` and `SPECGATE_ATTEMPT` in its environment.
Worktrees are removed after each requirement; `--keep-worktrees` keeps them.

## A chain of requirements, merged as they pass

```bash
specgate harness run --chain --req REQ-002 --req REQ-003
```

With `--chain`, requirements run one at a time, in order, each cut from the
previous merge. A green one is merged into the branch you are on (a merge
commit; its prompts stay on its `harness/` branch), and **the gate runs again
on the merge**. A red result is undone and the chain stops.

### On a ticket's branch

For work that comes from a Jira ticket, run the chain on the ticket's branch:

```bash
git switch feature/KAN-13-register-vehicle-entry
specgate harness run --chain
```

`specgate propose --from-ticket KAN-13` created that branch and the change.
Each requirement of the change is merged into the ticket's branch as it
passes, and every commit and merge commit starts with the ticket key
(`KAN-13 REQ-007: …`), so Jira shows them on the ticket. Then archive the
change and open the pull request with `specgate alm pr <change-id>`. See
[From a Jira ticket](from-a-ticket.md).

### Watch it work

Run `specgate studio` and open `/live`: attempts, phases, files, tests and
steps as they happen, read from `.harness/events/` (ignored by git). Claude
Code reports its steps too when it writes `stream-json` and its output goes
through `specgate harness events --from claude`:

```yaml
# harness.config.yaml
agent: "claude -p --output-format stream-json --verbose < {prompt_file} | specgate harness events --from claude"
```

## Parallel branches and the traceability matrix

Each harness branch changes its own row in `docs/specs/traceability.md`.

**A generated matrix** (the default) never blocks a merge: it is declared
`merge=union` in `.gitattributes`, git keeps both sides' rows, and
`specgate check` regenerates the file
([ADR-0036](specs/adr/0036-a-gate-a-team-can-trust.md)).

**A hand-kept matrix** needs a merge driver that merges by row, because git
merges by line and two neighbouring rows conflict even when they belong to
different requirements. `specgate harness init` registers that driver and
writes `.gitattributes`:

```bash
specgate harness init --project-dir .
git add .gitattributes && git commit -m "merge the matrix by row"
```

The driver is local git configuration, so every clone and every CI job needs
`specgate harness init` once. Until then git falls back to its normal merge,
and `specgate doctor` reports the gap.

It still **conflicts** when two branches set the same row to different values.
Keep exactly one of the two lines and delete the three marker lines; **never
keep both**, because a duplicated requirement row is corruption. Then run
`specgate validate .`, which checks the statuses and that no scenario id
repeats.

## Parallel branches and capability specs

With one change per ticket, two branches often archive into the same
capability, `docs/specs/capabilities/<name>/spec.md`. Git would conflict on
the whole file when the capability is new on both. `specgate harness init`
also registers a driver for these files that merges **requirement by
requirement**: requirements with different ids are united and sorted by id,
and a requirement changed on one side only takes that side.

It **conflicts** only when both branches rewrote the same requirement
differently, the case `change_overlap` warned about before either branch was
merged. Write the requirement as it should read once both changes hold,
delete the marker lines, and run `specgate check`.

**In a project without its own `node_modules`**, Maven for one, the drivers
run this machine's copy of specgate. If that copy goes away (an `npx` cache
cleared, a global install removed), the drivers say so and git merges these
files by lines, with its usual conflict markers, and `specgate doctor` warns.
Run `specgate harness init` again to point them at the copy you have now.

## Run more than one requirement at a time

```bash
specgate harness run --concurrency 4
```

**Only requirements that do not depend on each other run together.** The
harness reads the `depends=` keys in each requirement's `specgate:trace`
comment and works through the queue in levels: everything in a level is
independent and goes out at once; the next level waits.

**A failure blocks what depends on it; it does not fail it.** The agent is not
paid for work that cannot succeed:

```
  ❌ REQ-001  fail (1 attempt)     → harness/REQ-001
  ⛔ REQ-002  blocked (0 attempts) → harness/REQ-002
       Not attempted: REQ-001 did not pass.

  0 passed · 1 failed · 0 skipped · 1 blocked
```

A requirement in a dependency cycle is reported the same way and never
attempted; `specgate validate` explains the cycle.

**The base is derived.** A requirement is cut from the branch of the
requirement it depends on, because that is where its code exists during a run.
The harness warns when that base is behind your main branch:

```
⚠️  REQ-002: base harness/REQ-001 is 3 commit(s) behind main.
    A fix that landed on main is not in this worktree —
    a gate failure may not be about REQ-002.
```

**A requirement with several dependencies gets them merged** into a throwaway
`harness/base/REQ-NNN` branch first:

- Conflicts in `docs/specs/traceability.md` keep the base's version. Sibling
  branches always conflict there, because each one marks its own requirement
  Implemented with `specgate apply`, editing the same table. The real
  `harness/REQ-NNN` branch keeps its own row.
- A conflict in a source file blocks the requirement and names the file: two
  dependencies changed the same code in incompatible ways.

**The default is 1.** Above 1, each requirement runs in a worker process, a
newer path than the serial one. And four green branches are four reviews.
`concurrency: 4` in `harness.config.yaml` sets it for the project.

## Unattended runs in CI

For a nightly job that leaves branches to review:

| Option                   | What it does                                                                    |
| ------------------------ | ------------------------------------------------------------------------------- |
| `--resume`               | Continues an interrupted run from the attempt it stopped on.                    |
| `--budget-seconds <n>`   | Stops cleanly before starting a requirement once the time is spent.             |
| `--max-requirements <n>` | Attempts at most n requirements.                                                |
| `--skip-not-ready`       | Skips requirements an agent cannot succeed at (no feature, unmet dependencies). |
| `--skip-baseline`        | Runs even when the base already fails `validate --strict`.                      |
| `--push`                 | Pushes each green `harness/REQ-NNN` branch.                                     |
| `--pr-cmd "<cmd>"`       | Runs after each push, with `{branch}` and `{req}` placeholders.                 |
| `--verbose`              | Streams the gate's output while it runs.                                        |

## When a run fails

**Before any agent runs**, the harness validates the base. The gate judges the
whole project, so a requirement outside the run that is past Draft with no test
(TDD-1, TDD-2), such as one marked Approved before its test, would fail every
attempt whatever the agent did, and the agent may not change its status. The
run stops there and lists them: write their tests or move them back to Draft,
or pass `--skip-baseline` to run anyway. What fails on the requirements being
run is theirs to fix, and does not stop it.

The report prints the tail of the gate output and the command that failed.
Some failures end the run after one attempt, because retrying cannot help:
see [Troubleshooting](troubleshooting.md#when-another-attempt-cannot-help).

The failed attempt is **committed on its branch** as `chore(REQ-NNN): attempt
FAILED the gate`, so you can read what the agent did. The requirement's status does not
change, because `specgate apply` never ran.

```bash
specgate harness run --req REQ-002 --format json      # the whole gate output
specgate harness run --req REQ-002 --keep-worktrees   # reproduce it in place
```

**A requirement that builds on another** runs with `--chain`, or with
`--base-branch harness/REQ-001`. That base branch also supplies the project
configuration, so a fix committed to `main` reaches the run only once the base
has it. Check the gate command the report prints.

To see what the harness has cost over time (first-attempt rate, time per
delivered requirement), see [What the harness has cost](harness-report.md).

## Next

- [Choosing and wiring your agent](agent-setup.md)
- [What the harness has cost](harness-report.md)
