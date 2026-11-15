# How-to guides

Task-shaped guides, each self-contained. Copy/paste should work end to end.

<!-- specgate:note -->
**Node.js ≥ 22**, `git`, a shell. Run commands from inside the project: they
walk up from the current directory looking for `spec.md`, `.specops.lock` or
`specops.config.yaml`. To point at another directory, most take
`--project-dir <path>`; `check` and `validate` take it as an argument
(`specgate check ../other-project`). Each command's `--help` says which.
<!-- specgate:endnote -->

## By task

| I want to… | Guide |
| --- | --- |
| Start, on a new project or an existing repo | [Getting started](getting-started.md) |
| Join a project that already uses Specgate | [Joining a project](quickstart.md) |
| Learn the daily loop: `propose`, `apply`, `status`, `archive` | [Getting started](getting-started.md#4-the-four-verbs) |
| Turn a client brief into requirements | [Write the brief](start/write-the-brief.md), then [From a client brief](from-a-brief.md) |
| Work from a Jira ticket | [From a Jira ticket](from-a-ticket.md) |
| Adopt an existing codebase whose work arrives as Jira tickets | [An existing codebase, with Jira](existing-project-with-jira.md) |
| Try the whole loop on a copy of my repository | `specgate onboard --tour`: [Command reference](commands.md#starting-a-project) |
| Adopt a repository that already ships, worked end to end | [Brownfield adoption, worked example](case-studies/case-1.md) |
| Draft requirements from code that already runs, and turn the gate on without a red build | [Specify a system that already runs](reverse.md) |
| Write requirements, scenarios and matrix rows | [Writing specs](writing-specs.md) |
| Make the gate run locally and in CI | [Validating](validating.md) |
| Open a change, deliver it, archive it, or change a spec that already shipped | [Change a shipped requirement](reviewing-changes.md) |
| Share domain knowledge across repos | [Domain packs](domain-packs.md) |
| Wire it into editors, agents, hooks and CI | [Automation](automation.md) |
| Drive it from Claude, Cursor or Copilot | [Agents](agents.md) |
| Hand requirements to an agent, and watch it work at `/live` | [The harness](harness.md) |
| Split the harness into a tester and an implementer, or cap its cost | [Lanes, roles and limits](harness-roles.md) |
| Install the loop as Agent Skills | [Agents](agents.md#wire-it-in) |
| Record architecture decisions, what the agent may decide, and the stack | [Decisions](decisions.md) |
| Keep a glossary, numbered business rules and domain diagrams | [Domain language](domain-language.md) |
| Show a change to people who do not read the repository | [Review with the business](business-review.md) |
| Serve the studio to a team, with roles and edits as pull requests | [The studio for a team](studio-team.md) |
| Write release notes, an acceptance checklist and user guides | [Handing over](transition.md) |
| Mirror requirements onto Jira, Azure Boards or GitHub Issues | [Jira, Azure Boards, GitHub](alm.md) |
| Work out why something is not behaving | [Troubleshooting](troubleshooting.md) |
| Look up a command | [Command reference](commands.md) |

## Longer reads

<!-- specgate:cards cols=3 -->
- [Getting started](getting-started.md) — The shortest complete pass: two journeys of five short pages, every output real.
- [Domain packs, end to end](packs-end-to-end.md) — Install a pack, upgrade it, take it off.
- [Tutorial](tutorial.md) — The long-form version on a pack, with the reasoning at each step.
<!-- specgate:endcards -->

The tutorial is deliberately one file: it is a narrative, not a set of tasks.

## Next

- [Getting started](getting-started.md) — install, pick your path, the four verbs
- [Command reference](commands.md) — every command and flag
