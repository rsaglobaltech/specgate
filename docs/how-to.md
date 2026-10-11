# How-to guides

Task-shaped guides, each self-contained. Copy/paste should work end to end.

<!-- csda:note -->
**Node.js ≥ 22**, `git`, a shell. Run commands from inside the project: they
walk up from the current directory looking for `spec.md`, `.specops.lock` or
`specops.config.yaml`. To point at another directory, most take
`--project-dir <path>`; `check` and `validate` take it as an argument
(`specgate check ../other-project`). Each command's `--help` says which.
<!-- csda:endnote -->

## By task

| I want to… | Guide |
| --- | --- |
| Start, on a new project or an existing repo | [Getting started](getting-started.md) |
| Start from a plan or a client's brief | [Write the brief](start/write-the-brief.md) |
| Adopt a repository that already ships, worked end to end | [Brownfield adoption, worked example](case-studies/case-1.md) |
| Write requirements, scenarios and matrix rows | [Writing specs](writing-specs.md) |
| Make the gate run locally and in CI | [Validating](validating.md) |
| Change a spec that already shipped | [Reviewing changes](reviewing-changes.md) |
| Share domain knowledge across repos | [Domain packs](domain-packs.md) |
| Wire it into editors, agents, hooks and CI | [Automation](automation.md) |
| Drive it from Claude, Cursor or Copilot | [Agents](agents.md) |
| Work out why something is not behaving | [Troubleshooting](troubleshooting.md) |
| Look up a command | [Command reference](commands.md) |

## By adoption level

Each level is useful on its own and never requires the ones above it.

| Level | You get | Read |
| --- | --- | --- |
| **L1** | Traceable specs in the repo | [Getting started](getting-started.md), [Writing specs](writing-specs.md) |
| **L2** | A PR gate that enforces spec and test coverage | [Validating](validating.md) |
| **L3** | Versioned, reusable domain requirements | [Domain packs](domain-packs.md) |
| **L4** | Agent-driven delivery, one requirement at a time | [Automation](automation.md), [Agents](agents.md) |

## Longer reads

<!-- csda:cards cols=3 -->
- [Getting started](getting-started.md) — The shortest complete pass: two journeys of five phases, every output real.
- [Domain packs, end to end](packs-end-to-end.md) — Install a pack, upgrade it, take it off.
- [Tutorial](tutorial.md) — The long-form version on a pack, with the reasoning at each step.
<!-- csda:endcards -->

The tutorial is deliberately one file: it is a narrative, not a set of tasks.
