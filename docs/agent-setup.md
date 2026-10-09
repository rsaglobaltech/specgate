# Choosing and wiring your agent

The harness has no agent runtime and no SDK dependency. **The agent is any shell
command containing `{prompt_file}`** — the harness writes the prompt to a
temporary file, substitutes the path, runs the command, and reads its exit code
plus the gate result.

That is the whole contract. Everything below is detail.

```bash
specgate harness run --req REQ-001 --agent "claude -p < {prompt_file}"
```

## The commands for the tools people actually use

Each of these is a working `--agent` value. Pick the one you have.

| Tool | `--agent` value |
| --- | --- |
| Claude Code | `claude -p < {prompt_file}` |
| Aider | `aider --yes --message-file {prompt_file}` |
| Cursor CLI | `cursor-agent --prompt-file {prompt_file}` |
| OpenCode | `opencode run "$(cat {prompt_file})"` |
| Anything else | `./my-agent.sh {prompt_file}` |

**Tool allowances matter more than the model.** An agent in non-interactive mode
cannot ask permission, so without them it reads the prompt, fails to write a
file, and the attempt is wasted:

```bash
specgate harness run --agent "claude -p --allowedTools Read Write Edit Glob Grep 'Bash(npm:*)' < {prompt_file}"
```

Scope them rather than reaching for `--dangerously-skip-permissions`. The agent
needs `Bash` to run the project's build, and `Bash(npm:*)` is enough for a Node
project. It works inside a throwaway git worktree, which is the whole reason the
harness uses one.

## A tool whose invocation fits none of those

Write a wrapper. It is three lines, and it is the supported answer — not a
workaround:

```bash
#!/bin/sh
# my-agent.sh — $1 is the path to the prompt file
exec some-agent --instructions "$(cat "$1")"
```

```bash
specgate harness run --agent "./my-agent.sh {prompt_file}"
```

The harness never inspects the command. If your tool reads the prompt from
stdin, from a flag, from an environment variable or from a file it is told
about, a wrapper turns that into the one shape the harness expects.

## Committing the commands your team uses

Typing the command every run is how it ends up different on every machine. Put
the ones your team uses in `.harness/profiles.yaml` and name one:

```yaml
# .harness/profiles.yaml
profiles_version: 1
profiles:
  local:
    agent: "claude -p --allowedTools Read Write Edit 'Bash(npm:*)' < {prompt_file}"
  ci:
    agent: "aider --yes --message-file {prompt_file}"
```

```yaml
# harness.config.yaml
agent_profile: local
```

**Write profiles in block form, as above.** The reader is a dependency-free YAML
subset, and an inline mapping — `local: { agent: "…" }` — parses as a *string*,
leaving the profile with no `agent` and the run stopping with `no profile 'local'
with an agent`.

An explicit `agent:` in `harness.config.yaml` beats a profile: the narrower
statement wins.

## A different agent per requirement

A profile that declares `match:` selects itself, so one run can give an
infrastructure requirement different tools from a domain one — instead of the
allowances being the greatest common denominator of the whole plan:

```yaml
profiles:
  infra:
    agent: "claude -p --allowedTools Read Write Edit 'Bash(terraform:*)' < {prompt_file}"
    match: { bounded_context: Platform }
  domain:
    agent: "claude -p --allowedTools Read Write Edit 'Bash(npm:*)' < {prompt_file}"
    match: { bounded_context: "*" }
```

First match wins, so order in the file is the priority, and a `"*"` catch-all
belongs last. No match uses the run's default — that is not an error.

Matchable keys are `bounded_context`, `requirement`, `feature` and `category`.
An **unknown key matches nothing** rather than being ignored, so
`bounded_contex:` — one letter short — cannot quietly become a rule that matches
everything.

`specgate expand` records each requirement's bounded context beside the traceability
matrix, so the match has something to work with without anybody maintaining a
second list.

## A ladder of roles within one requirement

`attempt_profiles` names a profile per attempt, and the last rung repeats — a
cheaper model first, a stronger one on the retry:

```yaml
attempt_profiles: [fast, strong]
review_profile: reviewer     # advisory: it never approves
```

A reviewer runs before a retry, its findings go into the next prompt, and
anything it wrote is discarded. That is the line between this and a committee:
**the gate stays the only judge.**

## What a run costs

The harness measures wall-clock, because an agent is any shell command and only
the agent knows what it spent in tokens. A profile may declare an estimate:

```yaml
profiles:
  local:
    agent: "claude -p < {prompt_file}"
    cost_per_run_hint: 0.35
```

`specgate harness report` multiplies it out and labels it *declared, not measured*.
Attempts by a profile with no hint are counted separately, so the total never
reads as complete when part of the run is missing from it.

Put a ceiling on the run itself:

```bash
specgate harness run --budget-seconds 3600 --max-requirements 5
```

Both are checked **before starting** each requirement, never mid-attempt —
interrupting one would throw away the money already spent on it. Running out is
not an error: the run ends normally, names what it never started, and still
writes its ledger.

## Two things that will bite you

**A command without `{prompt_file}` is refused.** The harness will not guess
where your agent wants the prompt:

```
❌ The agent command must contain the {prompt_file} placeholder,
   e.g. --agent "claude -p < {prompt_file}"
```

**The agent works in a fresh worktree, which carries only what git tracks.**
There is no `node_modules`, no `target/`, no `.venv`. An agent must not spend
its attempt installing dependencies — put that in the gate command, which is the
only part that knows how:

```bash
specgate harness run --test-cmd "npm ci && npm test"
```

This was found the expensive way: an agent spent its first attempt on `npm
install` and timed out.

## Trying it without spending anything

Every one of these is safe to run against a real project:

```bash
specgate harness prompt REQ-001          # the exact prompt, printed, no agent
specgate harness run --dry-run           # what it would do, in order
specgate harness run --agent "true {prompt_file}" --max-attempts 1
```

The last one runs the whole loop with an agent that does nothing, which is the
quickest way to find out whether your gate can go green at all before an agent
is paid to try.

## Show the agent what "accepted" looks like here

```yaml
# harness.config.yaml
prompt_precedents: 1
```

Everything else in the prompt is **normative** — the requirement's facts, its
Gherkin, `AGENTS.md`, the definition of done. None of it is an *example*, and
an agent starts every requirement with no conversation history, so it has never
seen what an accepted implementation looks like in your repository. It invents a
house style, and the next attempt is spent correcting it.

With this on, the prompt gains one section: the most recent **Verified**
requirement in the same bounded context, with the first forty lines of its test
and of its production code. Three rules decide what is shown, and each exists to
stop the section doing harm:

| Rule | Why |
| --- | --- |
| Same bounded context, from the `context=` key `expand` already derives | A precedent from elsewhere teaches conventions that do not apply — with the authority of having been accepted |
| `Verified`, never `Implemented` | One means the code exists; the other means somebody checked it |
| An earlier requirement only | Precedent means already settled |

The section says in as many words that it is an example of *shape*, not of
behaviour, so it is not read as a second specification. If nothing qualifies it
does not appear — never empty — and a moved artifact never stops a run.

Off by default: it costs prompt budget and says nothing until a project has
accepted work to point at.

## Let something try to break it

```yaml
# harness.config.yaml
adversary_profile: breaker
```

```yaml
# .harness/profiles.yaml
profiles_version: 1
profiles:
  breaker:
    advisory: true
    agent: "claude -p < {prompt_file}"
```

The reviewer above returns **prose**. An adversary returns a **test**, and a
test either fails or it does not — one is an argument, the other is evidence.

Once a requirement's gate has gone green and the work is committed, the
adversary is asked for one additional test: a case the requirement should
handle and might not — an empty input, a boundary, a duplicate, a failure path.
The project's own test command then runs again with that test in place.

**A failing probe never changes the verdict.** The requirement still passes, and
a warning is recorded on the run:

```
⚠️  REQ-007: The gate passed for REQ-007, and an adversarial probe then made the
    project's tests fail. That is either a defect the scenario does not cover,
    or a test asserting something REQ-007 never promised.
```

That wording is the design. An adversary can always assert a behaviour nobody
specified, so letting it fail the run would block work that is correct — and
would make it a second judge. `validate --strict` plus your test command
stay the only one, for the same reason the reviewer is advisory.

The probe runs **once per requirement**, only on a green gate, and its writes
are discarded so the branch carries the implementer's work alone. The profile
must declare `advisory: true`; without it the harness refuses to start, because
a profile whose output you expect to be kept is not an adversary.

## Next

- [The harness](harness.md) — what happens around the agent: worktrees, the
  gate, retries, resuming and the run ledger.
- [Agent tools](agents.md) — wiring Claude Code, Cursor, Copilot and six others
  into the same loop, so the instructions live in one place.
