# Command reference

Every Specgate command, one line each, grouped by the job you are doing. Each
row links to the page that explains it in full.

`specgate --help` lists the daily loop. `specgate --help --all` lists every
command, and `specgate <command> --help` shows a command's options. To make the
full list the default, run `specgate config set profile full`.

In these tables, a **change** is a folder under `docs/specs/changes/<id>/` that
proposes new or changed requirements; the **gate** is `specgate check`. See
[the vocabulary](concepts.md#vocabulary) for the other terms.

## The loop

| Command                        | What it does                                                                 | Details                                                                 |
| ------------------------------ | ---------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| `specgate init`                | Adopts a repository that has code, or scaffolds a new project.               | [Getting started](getting-started.md)                                   |
| `specgate propose <change-id>` | Opens a change: a proposal, a delta and a reserved range of REQ ids.         | [Change a shipped requirement](reviewing-changes.md)                    |
| `specgate apply [<REQ>]`       | Delivers one requirement: refused until a test names it and the gate passes. | [Writing specs](writing-specs.md#after-implementing-apply-it)           |
| `specgate status`              | What is left, and the one command to run next.                               | [Writing specs](writing-specs.md#close-the-loop-status-implement-apply) |
| `specgate archive <change-id>` | Merges a change into the specs once every requirement in it is Implemented.  | [Change a shipped requirement](reviewing-changes.md#6-archive-it)       |
| `specgate check`               | The gate: `validate --strict`, your architecture check, then your tests.     | [Validating](validating.md)                                             |

`apply` does not commit; commit after it. `archive` runs on your branch, before
the pull request, so the spec and the code are reviewed together.

## Where work comes from

| Command                                         | What it does                                                                    | Details                                                          |
| ----------------------------------------------- | ------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| `specgate propose <change-id>`                  | One behaviour: you write the delta yourself.                                    | [Change a shipped requirement](reviewing-changes.md)             |
| `specgate propose --from-brief`                 | Lists the modules of `docs/brief.md` and the next one to draft.                 | [From a brief](from-a-brief.md)                                  |
| `specgate propose --from-brief --new-brief`     | Writes a `docs/brief.md` for you to fill in. Never overwrites one.              | [Write the brief](start/write-the-brief.md)                      |
| `specgate propose --from-brief --check`         | Runs the brief rules (B1–B13) on the brief. Writes nothing.                     | [Write the brief](start/write-the-brief.md#step-8-check-it)      |
| `specgate propose --from-brief --agent "<cmd>"` | Your agent proposes the brief's fields, then a section per module.              | [From a brief](from-a-brief.md)                                  |
| `specgate propose --from-brief <module>`        | Opens that module's draft change, or checks it once it exists.                  | [From a brief](from-a-brief.md#2-draft-one-module)               |
| `specgate propose --from-ticket <KEY>`          | Opens a change from a Jira ticket, on a new `feature/<KEY>-<slug>` branch.      | [From a Jira ticket](from-a-ticket.md)                           |
| `specgate propose --from-ticket <KEY> --check`  | The ticket's Definition of Ready (rules T1–T9). Writes nothing.                 | [From a Jira ticket](from-a-ticket.md#is-the-ticket-ready)       |
| `specgate alm pr <change-id>`                   | Pushes the ticket's branch and opens or updates its one pull request on GitHub. | [From a Jira ticket](from-a-ticket.md#the-daily-loop-per-ticket) |

More options for `--from-ticket`: `--agent "<cmd>"` has your agent draft the
change, `--capability <name>` names the capability when the ticket's epic is
not mapped, `--no-branch` skips creating the branch, and `--no-push` creates it
without pushing. A ticket can also be a file: `--from-ticket KAN-13.json`.
For `--from-brief <module>`, `--agent "<cmd>"` hands the draft to your agent and
`--reserve <n>` sets how many REQ ids it reserves (default 10). On a draft that is
already open, it grows the range to n, as long as no later change has reserved the
ids after it: open modules one at a time to keep that possible.

## Starting a project

| Command                                              | What it does                                                                       | Details                               |
| ---------------------------------------------------- | ---------------------------------------------------------------------------------- | ------------------------------------- |
| `specgate init --new`                                | Scaffolds a new project even where code already exists.                            | [Getting started](getting-started.md) |
| `specgate init --forja <name>`                       | Generates a whole application with forja, wired for Specgate.                      | [forja](forja/specgate.md)            |
| `specgate init --from-pack <repo>@<tag> --pack <id>` | Scaffolds and installs a pinned domain pack in one step.                           | [Domain packs](domain-packs.md)       |
| `specgate init --multi-stack <a,b>`                  | One sibling project per stack, sharing one `spec.md` and `features/`.              | `specgate init --help`                |
| `specgate adopt`                                     | Installs Specgate in an existing repository. Never overwrites a file.              | [Getting started](getting-started.md) |
| `specgate onboard`                                   | Proposes the capabilities an existing repository's layout implies. Writes nothing. | `specgate onboard --help`             |
| `specgate onboard --tour`                            | Runs the whole loop on a temporary copy of your repository, narrated.              | `specgate onboard --help`             |
| `specgate add usecase <module/Name>`                 | In a forja project: the class, its test and its wiring (also `entity`, `port`).    | `specgate add --help`                 |

**forja is not on the npm registry.** `init --forja` runs
`npx @rsaglobaltech/forja@1` unless the `SPECGATE_FORJA_CMD` environment
variable names another command. Install forja from its GitHub release
tarball, then point Specgate at it:

```bash
npm install -g https://github.com/rsaglobaltech/forja/releases/download/v1.0.0/rsaglobaltech-forja-1.0.0.tgz
SPECGATE_FORJA_CMD=forja specgate init --forja shop
```

**`init --from-pack` has a known issue:** it fails on a requirement with two
scenarios. Until it is fixed, run `specgate init` and then `specgate specops add`.

## Requirements

| Command                                 | What it does                                                                                 | Details                                                                 |
| --------------------------------------- | -------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| `specgate new "<title>"`                | Adds one requirement straight to `spec.md`, without a change. A shortcut for small projects. | [Writing specs](writing-specs.md)                                       |
| `specgate req add "<title>"`            | Adds a Draft requirement and its matrix row.                                                 | `specgate req --help`                                                   |
| `specgate req link <REQ> --test <path>` | Records a link (`--feature`, `--test`, `--code`, …) for a requirement.                       | `specgate req --help`                                                   |
| `specgate req rm <REQ>`                 | Removes a requirement's row and prose. `--force` past Draft.                                 | [Writing specs](writing-specs.md#removing-a-requirement)                |
| `specgate req list`                     | Lists requirements and their status.                                                         | `specgate req --help`                                                   |
| `specgate plan`                         | Requirements that still need a test, code or a status change.                                | [Writing specs](writing-specs.md#close-the-loop-status-implement-apply) |
| `specgate explore ["<question>"]`       | A snapshot of the project to think with, before a change exists. Writes nothing.             | `specgate explore --help`                                               |
| `specgate questions`                    | Everything waiting for an answer: open questions, what they block, requirements waiting.     | `specgate questions --help`                                             |
| `specgate answer <Q> "<answer>"`        | Writes the answer and an assumption to review; `--reviewed` once the spec reflects it.       | `specgate answer --help`                                                |
| `specgate ask <REQ> "<question>"`       | Asks instead of guessing: the requirement waits. The harness agent can run it too.           | `specgate ask --help`                                                   |
| `specgate brief add <module> "<text>"`  | A new requirement for a module the brief covers, archived or not, quoting the text.          | `specgate brief add --help`                                             |
| `specgate matrix`                       | Regenerates the traceability matrix from `spec.md`, tags and tests.                          | [A matrix nobody edits](writing-specs.md#a-matrix-nobody-edits)         |
| `specgate fix`                          | Applies the repairs `validate` suggests. `--dry-run` previews.                               | `specgate fix --help`                                                   |
| `specgate validate . --strict`          | Checks specs, scenarios, links and coverage, without running tests.                          | [Validating](validating.md)                                             |

## Changes

| Command                                             | What it does                                                                | Details                                                                         |
| --------------------------------------------------- | --------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| `specgate change list`                              | Open changes and their task progress.                                       | [Change a shipped requirement](reviewing-changes.md)                            |
| `specgate change show <id>`                         | A change's proposal, deltas and what they touch.                            | [Change a shipped requirement](reviewing-changes.md)                            |
| `specgate change status [<id>]`                     | Which file of the change to write next.                                     | [Change a shipped requirement](reviewing-changes.md)                            |
| `specgate change instructions <artifact>`           | The template and rules for one file of a change, for you or an agent.       | [Agents](agents.md#why-the-generated-files-are-thin)                            |
| `specgate change author <id>`                       | Has an agent write one file of a change, confined to the change folder.     | [Change a shipped requirement](reviewing-changes.md#have-an-agent-draft-a-file) |
| `specgate change validate [<id>]`                   | Checks the deltas. `specgate validate` runs it too.                         | [Change a shipped requirement](reviewing-changes.md)                            |
| `specgate change new <id> --modify <REQ>`           | Opens a change with the requirement copied into a MODIFIED delta, Draft.    | [Change a shipped requirement](reviewing-changes.md)                            |
| `specgate change impact <REQ\|id>`                  | Spec, features, tests, files and requirements a change to it touches.       | [Change a shipped requirement](reviewing-changes.md)                            |
| `specgate change approve <id> [--layer <layer>]`    | Approve the layers you own; the harness and Build wait for all of them.     | [Change a shipped requirement](reviewing-changes.md)                            |
| `specgate change note <id> "<text>"`                | Asks the draft for a change in your words, kept in review.md (`--req REQ`). | [Change a shipped requirement](reviewing-changes.md)                            |
| `specgate propose <id> --from-value-drift <REQ:id>` | Opens a change that updates a declared value the code disagrees with.       | [Validating](validating.md#declared-value-drift-a-report-not-a-gate)            |

## Jira and other trackers (ALM)

| Command                           | What it does                                                                              | Details                                                          |
| --------------------------------- | ----------------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| `specgate alm sync`               | Mirror mode: creates an issue per requirement and closes it when the requirement is done. | [Jira and Azure Boards](alm.md)                                  |
| `specgate alm pull`               | Opens a change for each issue with a label (`--label <name>`).                            | [Jira and Azure Boards](alm.md#bring-issues-in-alm-pull)         |
| `specgate alm link <REQ> <issue>` | Maps an existing issue to a requirement.                                                  | [Jira and Azure Boards](alm.md)                                  |
| `specgate alm status`             | The requirement-to-issue mapping, without network access.                                 | [Jira and Azure Boards](alm.md)                                  |
| `specgate alm pr <change-id>`     | One pull request per ticket on GitHub. `--no-push`, `--no-check`.                         | [From a Jira ticket](from-a-ticket.md#the-daily-loop-per-ticket) |

All of these read `alm.config.yaml` at the project root. It names environment
variables that hold the tokens, never the tokens themselves. Jira has two modes
— a ticket as the source of a change, or a mirror of your requirements — and
you pick one per project: see [From a Jira ticket](from-a-ticket.md) and
[Jira and Azure Boards](alm.md).

## Automation and CI

| Command                                 | What it does                                                                | Details                                        |
| --------------------------------------- | --------------------------------------------------------------------------- | ---------------------------------------------- |
| `specgate harness init`                 | Writes `harness.config.yaml` and the prompt prefix. Leaves the agent unset. | [The harness](harness.md#set-it-up)            |
| `specgate harness run`                  | Delivers pending requirements with an agent; `--profile` picks which one.   | [The harness](harness.md)                      |
| `specgate harness prompt <REQ>`         | Prints the prompt an agent would get. Runs nothing.                         | [Choosing your agent](agent-setup.md)          |
| `specgate harness report`               | First-attempt rate and time per delivered requirement.                      | [What the harness has cost](harness-report.md) |
| `specgate harness events --from claude` | Turns Claude Code's stream into events for the live view.                   | [The harness](harness.md#watch-it-work)        |
| `specgate studio`                       | The visual app, from an empty folder to the report; `/live`: the harness.   | `specgate studio --help`                       |
| `specgate ci init`                      | Writes the CI job for GitHub, GitLab, Azure or Jenkins.                     | [Validating](validating.md)                    |
| `specgate quality init [--level]`       | Writes the checks of basic or strict for the stack, all in Docker.          | `specgate quality --help`                      |
| `specgate quality list`                 | The quality checks of the gate: stage, gate or advise, how each runs here.  | `specgate quality --help`                      |
| `specgate quality doctor [--pull]`      | The same, with what is missing; `--pull` fetches the Docker images now.     | `specgate quality --help`                      |
| `specgate quality run [--stage]`        | Runs the checks of a stage: attempt, end or ci.                             | `specgate quality --help`                      |
| `specgate quality baseline`             | Records today's SARIF findings as debt: only new ones fail from then on.    | `specgate quality --help`                      |
| `specgate workspace init`               | Names the repositories of one product in `specgate.workspace.yaml`.         | [Workspace](workspace.md)                      |
| `specgate workspace status`             | Each repository's requirements, branch and gate, and each story.            | [Workspace](workspace.md)                      |
| `specgate workspace check`              | Every repository's gate, qualified ids and cross-repository dependencies.   | [Workspace](workspace.md)                      |
| `specgate workspace propose <story>`    | A business story, and a change for it in each repository named.             | [Workspace](workspace.md)                      |
| `specgate check --ci`                   | The gate in CI: also the `ci` checks, and a check that cannot run fails.    | [Validating](validating.md)                    |
| `specgate verify`                       | For OpenSpec projects: fails while a done scenario has no test naming it.   | [Already on OpenSpec](openspec.md)             |
| `specgate report`                       | A spec-coverage dashboard as one HTML file.                                 | `specgate report --help`                       |
| `specgate doctor`                       | Diagnoses the project and the environment, with a fix per finding.          | [Troubleshooting](troubleshooting.md)          |

## Agents

| Command                                | What it does                                                          | Details                  |
| -------------------------------------- | --------------------------------------------------------------------- | ------------------------ |
| `specgate agents init`                 | Slash commands and instruction files for your agent tools.            | [Agents](agents.md)      |
| `specgate update`                      | Refreshes those generated files after an upgrade, keeping your edits. | [Agents](agents.md)      |
| `specgate mcp install --client claude` | Writes the MCP server configuration for Claude Desktop or Cursor.     | [The MCP server](mcp.md) |
| `specgate mcp serve`                   | Runs the MCP server over stdio. The client starts it; you do not.     | [The MCP server](mcp.md) |

## Domain packs

| Command                       | What it does                                                       | Details                                                         |
| ----------------------------- | ------------------------------------------------------------------ | --------------------------------------------------------------- |
| `specgate specops add`        | Installs a pack at a pinned tag and records it in `.specops.lock`. | [Domain packs](domain-packs.md)                                 |
| `specgate specops remove`     | Drops a pack from `.specops.lock`.                                 | [Domain packs](domain-packs.md)                                 |
| `specgate specops sync`       | Re-renders the installed packs, keeping your local edits.          | [Domain packs](domain-packs.md)                                 |
| `specgate specops diff`       | Previews a version bump; `--as-change` turns it into a change.     | [Domain packs](domain-packs.md)                                 |
| `specgate specops contribute` | Sends a local change back to the pack. Never pushes.               | [Domain packs](domain-packs.md)                                 |
| `specgate pack init`          | Scaffolds a new pack.                                              | [Domain packs](domain-packs.md)                                 |
| `specgate pack lint`          | Checks a pack before anyone installs it.                           | [Domain packs](domain-packs.md)                                 |
| `specgate pack infer`         | Proposes a `pack.yaml` from a `.feature` file.                     | [Domain packs](domain-packs.md)                                 |
| `specgate pack bundle`        | Exports a pack repository as one file for offline networks.        | [Supply chain](supply-chain.md#air-gapped-and-offline-networks) |
| `specgate expand`             | Low-level pack rendering. Prefer `specops add`.                    | [Domain packs](domain-packs.md)                                 |

## Customising

| Command                                | What it does                                                                   | Details                       |
| -------------------------------------- | ------------------------------------------------------------------------------ | ----------------------------- |
| `specgate config set test_cmd "<cmd>"` | The tests `check` and `apply` run.                                             | `specgate config set --help`  |
| `specgate config set arch_cmd "<cmd>"` | Your architecture check, run by the gate before the tests.                     | [Validating](validating.md)   |
| `specgate config set profile full`     | Makes `--help` list every command (`core` lists the loop).                     | `specgate config set --help`  |
| `specgate config set language es`      | The language of generated prose. Keywords stay in English.                     | `specgate config set --help`  |
| `specgate config init`                 | Writes a starter `project.yaml`.                                               | `specgate config init --help` |
| `specgate schema which`                | Shows which artefact graph a change follows (also `init`, `fork`, `validate`). | `specgate schema --help`      |
| `specgate completion zsh`              | Prints shell completion for bash, zsh or fish.                                 | `specgate completion --help`  |

## The small things

| Command                       | What it does                                                      | Details                      |
| ----------------------------- | ----------------------------------------------------------------- | ---------------------------- |
| `specgate pet`                | Gato, the cat that keeps the gate: the project's health as a pet. | `specgate pet --help`        |
| `specgate config set pet off` | Hides Gato from the end of `status`.                              | `specgate config set --help` |

## Output and exit codes

Many commands take `--json` and then print one JSON document on standard
output; [the agent contract](specs/agent-contract.md) lists the format and
every diagnostic code.

| Code | Meaning                                              |
| ---- | ---------------------------------------------------- |
| `0`  | Success, including advisory warnings                 |
| `1`  | Failure, or a gate that found something              |
| `2`  | Usage error: an unknown flag or a missing argument   |
| `3`  | A required script is missing (a broken installation) |

## Old names

These names still work, so older scripts keep running. Use the new name in
anything you write.

| Old name                  | Use instead                     |
| ------------------------- | ------------------------------- |
| `specgate draft`          | `specgate propose --from-brief` |
| `specgate done`           | `specgate apply`                |
| `specgate change new`     | `specgate propose`              |
| `specgate change archive` | `specgate archive`              |
