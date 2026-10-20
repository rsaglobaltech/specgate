# Choosing and wiring your agent

At the end of this page you have an agent command that the harness and the
drafting commands can run, with the permissions it needs, the dependencies it
expects, and a profile your team shares.

**You need:** a coding agent you can run from the command line (Claude Code,
Aider, OpenCode, Codex…), signed in with your own credentials. Specgate has no
agent runtime and no SDK: **the agent is any shell command.** What the harness
does around the agent (worktrees, the gate, chains, parallel runs) is on
[The harness](harness.md).

## The contract: `{prompt_file}`

Specgate writes the prompt to a temporary file and puts that file's path where
`{prompt_file}` stands in your command. It runs the command, then judges the
result with the gate, not with the agent's exit code alone.

```bash
specgate harness run --req REQ-001 --agent "claude -p < {prompt_file}"
```

| Command | Without `{prompt_file}` |
| --- | --- |
| `specgate harness run` | Refused. The harness never guesses where the prompt goes. |
| `specgate change author` | Refused, for the same reason. |
| `specgate propose --from-brief`, `--from-ticket` and `specgate explore` | The prompt arrives on standard input. |

So `specgate propose --from-brief billing --agent "claude -p"` works as it
is. In print mode Claude Code cannot write a file without permission, so for
these drafting commands Specgate adds `--permission-mode acceptEdits` when your
command carries no permission flag of its own, and says so. That is safe
because Specgate undoes every write outside the draft. Other agents need their
own auto-approve flag; if one runs and writes nothing, the command says that is
the likely cause.

## Commands for common tools

| Tool | `--agent` value |
| --- | --- |
| Claude Code | `claude -p < {prompt_file}` |
| Aider | `aider --yes --message-file {prompt_file}` |
| OpenCode | `opencode run "$(cat {prompt_file})"` |
| Cursor CLI | `cursor-agent -p "$(cat {prompt_file})"` |
| Anything else | `./my-agent.sh {prompt_file}` (a wrapper, below) |

The command runs in a shell, so `< {prompt_file}` and `"$(cat {prompt_file})"`
both work. Agent tools change their flags between versions: check each tool's
own documentation for the exact non-interactive flags, especially for OpenCode
and the Cursor CLI, whose rows show the shape rather than a tested command.
Run `specgate harness run --dry-run` to see the prompt before you pay for one.

## Tool allowances

An agent in non-interactive mode cannot ask for permission. Without
allowances it reads the prompt, fails to write a file, and the attempt is
wasted. Give it the tools it needs:

```bash
specgate harness run --agent "claude -p --allowedTools Read Write Edit Glob Grep 'Bash(npm:*)' < {prompt_file}"
```

Scope them rather than reaching for `--dangerously-skip-permissions`. The agent
needs `Bash` to build and test the project, and `Bash(npm:*)` is enough for a
Node project (`Bash(./mvnw:*)` for Maven, and so on). The harness runs it in a
throwaway git worktree, which limits what a mistake can reach.

## A tool whose invocation fits none of those

Write a wrapper. It is three lines, and it is the supported answer:

```bash
#!/bin/sh
# my-agent.sh — $1 is the path to the prompt file
exec some-agent --instructions "$(cat "$1")"
```

```bash
specgate harness run --agent "./my-agent.sh {prompt_file}"
```

Whether your tool reads the prompt from standard input, a flag, an environment
variable or a file, a wrapper turns it into the one shape Specgate expects.

## Dependencies: the setup command

The harness gives the agent a fresh git worktree, which holds only what git
tracks: no `node_modules`, no `target/`, no `.venv`. An agent must not spend
its attempt installing dependencies, so the harness installs them first, with
the **setup command**:

1. `--setup-cmd "<cmd>"` on the command line, or
2. `setup_cmd:` in `harness.config.yaml`, or
3. by default, the install your lockfile implies (`npm ci`, pnpm or yarn).

```yaml
# harness.config.yaml
setup_cmd: "./mvnw -q dependency:go-offline"
```

`--setup-cmd none` runs nothing. Keep the test command (`test_cmd:`) for tests
only: installing there would repeat the install on every gate run.

## Commit the commands your team uses

Typing the command on every run is how it ends up different on every machine.
Put your team's commands in `.harness/profiles.yaml` and name one:

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

**Write profiles in block form, as above.** Specgate reads a dependency-free
subset of YAML, and an inline mapping (`local: { agent: "…" }`) is read as a
string: the profile has no `agent` and the run stops with
`no profile 'local' with an agent`.

An explicit `agent:` in `harness.config.yaml` beats a profile: the narrower
statement wins. `specgate change author --agent-profile local` uses the same
profiles.

## A different agent per requirement

A profile that declares `match:` selects itself, so one run can give an
infrastructure requirement different tools from a domain one:

```yaml
profiles:
  infra:
    agent: "claude -p --allowedTools Read Write Edit 'Bash(terraform:*)' < {prompt_file}"
    match: { bounded_context: Platform }
  domain:
    agent: "claude -p --allowedTools Read Write Edit 'Bash(npm:*)' < {prompt_file}"
    match: { bounded_context: "*" }
```

The first match wins, so the order in the file is the priority and a `"*"`
catch-all goes last. No match uses the run's default agent.

You can match on `bounded_context`, `requirement`, `feature` and `category`.
An **unknown key matches nothing**, so a typo such as `bounded_contex:` cannot
become a rule that matches everything. `specgate expand` records each
requirement's bounded context, so domain-pack projects have something to match.

## A different agent per attempt

The same agent and model three times is mostly a re-roll. A ladder gives each
attempt its own profile, and can add an advisory reviewer before each retry:

```yaml
# harness.config.yaml
attempt_profiles:
  - implementer        # attempt 1
  - repairer           # attempt 2
  - repairer-strong    # attempt 3, and any after it
review_profile: reviewer
```

```yaml
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

A ladder shorter than `max_attempts` repeats its last rung. Without these keys,
one agent runs every attempt.

**The reviewer advises; it never approves.** It runs before each retry (never
before the first attempt), its output goes into the next prompt as findings,
and everything it wrote is discarded. The gate stays the only judge. A profile
named by `review_profile` must declare `advisory: true`, or the harness refuses
to start. `.harness/runs/<timestamp>.json` names the roles that ran each
attempt, and the branch keeps one prompt per role (`attempt-2-reviewer.md`,
`attempt-2-implementer.md`).

## Show the agent what "accepted" looks like

```yaml
# harness.config.yaml
prompt_precedents: 1
```

An agent starts every requirement with no history, so it has never seen an
accepted implementation in your repository and invents a house style. With
this setting the prompt gains one section: the most recent **Verified**
requirement in the same bounded context, with the first forty lines of its test
and its code. It must be Verified (someone checked it, not only Implemented),
from the same bounded context, and earlier than the current requirement. The
section says it shows *shape*, not behaviour, and it is left out when nothing
qualifies. It is off by default because it costs prompt space.

## Let something try to break it

```yaml
# harness.config.yaml
adversary_profile: breaker
```

```yaml
# .harness/profiles.yaml
profiles:
  breaker:
    advisory: true
    agent: "claude -p < {prompt_file}"
```

Once a requirement's gate is green and the work is committed, the adversary is
asked for one extra test: an empty input, a boundary, a duplicate, a failure
path. The project's tests then run again with it. **A failing probe never
changes the verdict**; it records a warning:

```
⚠️  REQ-007: The gate passed for REQ-007, and an adversarial probe then made the
    project's tests fail. That is either a defect the scenario does not cover,
    or a test asserting something REQ-007 never promised.
```

The probe runs once per requirement, only on a green gate, and its writes are
discarded. The profile must declare `advisory: true`.

## What a run costs

The harness measures wall-clock time, because only the agent knows what it
spent in tokens. A profile may declare an estimate per run, which
`specgate harness report` multiplies out and labels *declared, not measured*:

```yaml
profiles:
  local:
    agent: "claude -p < {prompt_file}"
    cost_per_run_hint: 0.35
```

Put a ceiling on a run:

```bash
specgate harness run --budget-seconds 3600 --max-requirements 5
```

Both are checked before each requirement starts, never in the middle of an
attempt. Running out is not an error: the run ends, names what it did not
start, and still writes its record.

## Try it without spending anything

```bash
specgate harness prompt REQ-001                                    # the exact prompt
specgate harness run --dry-run                                     # what it would do
specgate harness run --agent "true {prompt_file}" --max-attempts 1 # an agent that does nothing
```

The last one runs the whole loop with an agent that writes nothing: the
quickest way to learn whether your gate can go green at all before an agent is
paid to try.

## Next

- [The harness](harness.md)
- [Agents](agents.md)
