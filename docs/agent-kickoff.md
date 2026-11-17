# What to tell your agent

Specgate does not run your coding agent's thinking for it, and it does not need
your agent to study it either. It hands the agent what each step needs:
`AGENTS.md` (the contract), `specgate status` (the next step),
`DRAFTING.md` (the prompt for a module of the brief) and `specgate change
instructions <artifact> --json` (the exact format of any file). What you give
the agent is short: where to start, and what it must never do.

**You need:** a project where `specgate init` or `specgate adopt` has run, and
your agent's steps installed with `specgate agents init --tool <codex|opencode|claude>`.

## Get the prompt from the project

```bash
specgate status --prompt         # the next step, the brief's modules left to draft
specgate status --prompt draft   # the next module of the brief
specgate status --prompt build   # the next requirements, one at a time
```

It prints a prompt in English, written from the project as it is now — paste it
into Codex, OpenCode, Claude Code or any other agent. `--json` gives it as data.
The sections below are the same prompts, to read before you paste one.

## How each agent calls specgate's steps

| Agent       | Steps                                                             | Installed by                                                   |
| ----------- | ----------------------------------------------------------------- | -------------------------------------------------------------- |
| Codex       | `$specgate-draft`, `$specgate-apply`, `$specgate-check`… (skills) | `specgate agents init --tool codex` → `.agents/skills/`        |
| OpenCode    | `/specgate-draft`, `/specgate-apply`, `/specgate-check`…          | `specgate agents init --tool opencode` → `.opencode/commands/` |
| Claude Code | `/specgate:draft`, `/specgate:apply`, `/specgate:check`…          | `specgate agents init --tool claude` → `.claude/commands/`     |

The harness runs the agent `agent:` in `harness.config.yaml` names. `agents
init --tool codex` sets Codex's (`codex exec -s workspace-write - <
{prompt_file}`); change it with `specgate config set agent "<command>"`.

## A new project, from a brief

You write `docs/brief.md` — what the product is, its actors and its modules
([Write the brief](start/write-the-brief.md)) — then give the agent:

```text
This project uses specgate for spec-driven development. specgate is installed: run it as `specgate`.
Read AGENTS.md first: it is the contract you work under. Do not study specgate's own documentation;
specgate tells you what to do next.

Draft the modules of docs/brief.md, one at a time:
1. Run `specgate propose --from-brief <module>`. It opens the draft and writes DRAFTING.md in it.
2. Follow that DRAFTING.md: it is your prompt.
3. Run `specgate propose --from-brief <module>` again until it says "Ready to review".
4. Stop and say so: a person reviews each draft and answers its questions.
```

A person then reviews the draft, answers `questions.md` and approves it
(`specgate change approve <change> --layer …`, or the studio's Changes).

## An existing project

After `specgate adopt`:

```text
This project uses specgate. Read AGENTS.md first.
Write the first requirement from code that already exists: run `specgate propose <change-id>`,
write one requirement — one sentence of what the system SHALL do and a scenario with a real
example, the numbers an existing test already uses — then name it in that test and run
`specgate check`. Stop for a person to review it.
```

## Every day

```text
This project uses specgate. Read AGENTS.md first.
Build the next requirement:
1. Run `specgate status` and take the next requirement it names.
2. Write its test first, naming the requirement (REQ-NNN); see it fail.
3. Write the code until `specgate check` passes.
4. Run `specgate apply <REQ>`.
Repeat one requirement at a time. Stop when status names a step for a person.
```

Or leave it to the harness: `specgate harness run` gives each requirement to the
agent on its own branch and keeps only what passes the gate ([The harness](harness.md)).

## What the agent never does

Put this under every prompt; `specgate status --prompt` does:

```text
Rules you never break:
- Write the test first, and name the requirement in it: that mention is the link.
- Run `specgate check` before you say anything is done; only what it passes is done.
- Never edit spec.md, features/ or docs/specs/ to make a test pass.
- Never archive a change, approve a layer or answer a question in questions.md yourself: a person does.
- When a value is missing, ask (`specgate ask`) or record an assumption; never invent one.
```

The [guards](agents.md#the-guards) enforce the first and the last of these in
Claude Code and OpenCode, whatever the agent decides.

## Next

- [Agents](agents.md): what `agents init` writes for each tool
- [Choosing and wiring your agent](agent-setup.md): the command, profiles, ladders
- [The harness](harness.md): unattended runs
