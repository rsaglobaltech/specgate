<!-- specgate:allow-placeholders — this guide quotes the {{VAR}} template syntax. -->

# Troubleshooting

Find your problem by what you see, or by the code in brackets at the end of an
error line, such as `[matrix_stale]`. Every error Specgate prints already says
how to fix it; this page adds the cause and the context.

First, run the built-in diagnosis. It checks the environment, the project
structure and the traceability in both directions, and prints a fix for each
finding:

```bash
specgate doctor
```

## Index by code

| Codes                                                                                                                                                                                                                                                                                                              | Section                                 |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------- |
| `tests_not_configured`, `check_tests_failed`, `check_arch_failed`, `check_validate_failed`, `check_change_invalid`, `scenario_steps_unwritten`, `scenario_placeholder_step`, `scenario_not_covered`, `[TDD-1]`, `declared_artifact_missing`, `requirement_template_obligation`, `id_taken_on_base`, `matrix_stale` | [The gate](#the-gate)                   |
| `apply_no_test`, `done_validate_failed`, `done_tests_failed`, `done_needs_clarification`, `archive_requirements_pending`, `archive_draft_not_ready`                                                                                                                                                                | [Apply and archive](#apply-and-archive) |
| `D1`–`D12`, `draft_no_brief`, `draft_module_not_in_brief`, `draft_agent_failed`, `draft_agent_needs_git`, `draft_brief_text_lost`, `draft_brief_body_changed`                                                                                                                                                      | [Drafting](#drafting)                   |
| `T1`–`T9`, `ticket_*`, `pr_failed`, `change_overlap`, `change_id_clash`, `change_base_moved`                                                                                                                                                                                                                       | [Tickets](#tickets)                     |
| `requirement_scenario_unrunnable`, `agent_rewrote_gate_command`                                                                                                                                                                                                                                                    | [Harness](#harness)                     |
| `alm_config_unread_key`                                                                                                                                                                                                                                                                                            | [Tickets](#tickets)                     |

## Installation

| Symptom                                                | Cause                                        | Fix                                                                     |
| ------------------------------------------------------ | -------------------------------------------- | ----------------------------------------------------------------------- |
| `npx specgate` runs something else, or asks to install | The package is not installed in this project | `npm install --save-dev @rsaglobaltech/specgate`, then `npx specgate …` |
| You want to try it without installing                  | —                                            | `npx @rsaglobaltech/specgate@latest …`                                  |
| A syntax error or an engine warning at start           | Node.js older than 22                        | Install Node.js 22 or later                                             |
| The first `npx @rsaglobaltech/specgate@latest` is slow | npm downloads the package once               | Later runs use the cache; CI pins a version (see [CI](#ci))             |

### Upgrading a project from 0.18 or earlier

Since 0.19 everything is called `specgate`: the markers in your specs
(`<!-- specgate:trace … -->`), the `.specgate/` folder and the `SPECGATE_*`
variables. A project still on the old `csda:` format fails `validate` with
`old_format`, and the message names the command that migrates it, once
([ADR-0032](specs/adr/0032-one-name-everywhere.md)). After any upgrade, run
`specgate update`: it refreshes the agent contract in `AGENTS.md` and the
agent commands to the installed version.

## The gate

`specgate check` is the gate: it validates the specification, runs your
architecture check when one is set, then runs your tests. The most common
failures on a first pull request are explained with examples in
[Your team's first PR](first-pr.md#when-check-fails).

| Code or symptom                                                    | Cause                                                                  | Fix                                                                                              |
| ------------------------------------------------------------------ | ---------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| "checked the specification, not the code" (`tests_not_configured`) | No test command is configured, so no test ran                          | `specgate config set test_cmd "npm test"` (any command your project uses)                        |
| `check_tests_failed`                                               | Your tests failed                                                      | Read the test output above the line and fix the code or the test                                 |
| `check_arch_failed`                                                | The architecture check (`arch_cmd`) failed                             | Move the code to the layer the rule names; do not change the rule                                |
| `check_validate_failed`                                            | The specification has errors                                           | Fix each finding listed above it                                                                 |
| `check_change_invalid`, `scenario_steps_unwritten`                 | An open change has a scenario still holding `<placeholders>`           | Write the real Given/When/Then steps; `specgate change validate <id>` lists all                  |
| `scenario_placeholder_step`                                        | A feature file of a requirement being delivered still has placeholders | Write the real steps                                                                             |
| `scenario_not_covered`                                             | No test names the scenario                                             | Name it in the test that proves it (`SCN-007a`)                                                  |
| `[TDD-1]`                                                          | A requirement past Draft with no test that names it                    | Name `REQ-007` in its test, or set it back to Draft                                              |
| `declared_artifact_missing`                                        | A path written in a requirement's trace comment no longer exists       | Restore the file or correct the path                                                             |
| `requirement_template_obligation`                                  | A requirement claims delivery but still has the template sentence      | Write the real obligation                                                                        |
| `id_taken_on_base`                                                 | Another branch merged the same requirement id with another title       | Renumber yours to the id the message suggests                                                    |
| `matrix_stale` (CI only)                                           | `docs/specs/traceability.md` was not committed after a change          | Run `specgate check` locally and commit the matrix                                               |
| A merge conflict in `traceability.md`                              | A hand-kept matrix; a generated one merges by itself                   | See [Parallel branches and the matrix](harness.md#parallel-branches-and-the-traceability-matrix) |

The **traceability matrix** (`docs/specs/traceability.md`) is generated from
the specs, the feature files and the tests. Never add or edit its rows by
hand; fix the source and let `specgate check` regenerate it.

## Apply and archive

| Code                           | Cause                                                                | Fix                                                                           |
| ------------------------------ | -------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| `apply_no_test`                | No test names the requirement yet                                    | Write the test first and name `REQ-007` in it                                 |
| `done_validate_failed`         | `apply` ran the gate and it failed; nothing was written              | Fix what is listed above it and run `apply` again                             |
| `done_tests_failed`            | The tests failed during `apply`                                      | Fix them; `apply` marks nothing until they pass                               |
| `done_needs_clarification`     | The requirement waits for an answer to an open question              | Answer it in `questions.md`, then remove `Needs Clarification` from its trace |
| `archive_requirements_pending` | A requirement of the change is not Implemented                       | Run the `specgate apply REQ-…` it names; `--force` does not skip this         |
| `archive_draft_not_ready`      | A change opened from a brief or a ticket has open checklist findings | Run the `propose` command it names and fix the findings                       |

`apply` never commits. Commit after each requirement, and after `archive`.

## Drafting

A draft is a change opened from a brief or a ticket. The **D-rules** are the
drafting checklist that runs on it, D1 to D12; each is explained in
[From a client brief](from-a-brief.md#3-check-the-draft).

| Code or symptom                                     | Cause                                                       | Fix                                                                   |
| --------------------------------------------------- | ----------------------------------------------------------- | --------------------------------------------------------------------- |
| `draft_no_brief`                                    | No `docs/brief.md`                                          | `specgate propose --from-brief --new-brief` writes one to fill in     |
| `draft_module_not_in_brief`                         | The module is not listed under `modules:` in the brief      | Add it there                                                          |
| D6: a value is not in the brief                     | The draft uses a number or a name its source does not state | Ask the client, or record it in `assumptions.md`                      |
| D7: an open question                                | A question no requirement waits for                         | Make the requirement it blocks wait for it, or answer it              |
| `draft_agent_failed`                                | The agent command did not run or failed                     | Run the command on its own first; or paste the prompt into your agent |
| `draft_agent_needs_git`                             | `--agent` works only in a git repository                    | `git init`, or paste the prompt into your agent                       |
| "Undone — the agent wrote outside the draft"        | The agent changed files outside the change                  | Nothing to do: Specgate reverted them                                 |
| `draft_brief_text_lost`, `draft_brief_body_changed` | The agent changed the brief's own text                      | Nothing to do: Specgate restored it; try again, or write it yourself  |

## Tickets

Ticket problems, from a scoped Jira token to a ticket that never moves on the
board, are in the table of
[From a Jira ticket](from-a-ticket.md#troubleshooting): `T1`–`T9`,
`ticket_epic`, `ticket_changed`, `ticket_copy_edited`, `ticket_key_missing`,
`ticket_bad_key`, `ticket_no_capability` and the `specgate alm pr` errors
(`pr_failed`). The **T-rules** are the ticket's Definition of Ready.

`change_overlap` means two open changes rewrite the same requirement: one in
your branch, the other on the same branch or on another branch that is not
merged yet (`check` reads every local and remote-tracking branch). Merged as
they are, the second rewrite would replace the first, with or without a git
conflict. Agree which goes first, merge it, bring it into the other branch, and
draft the second change again over the requirement as merged. Run `git fetch`
first, so the remote branches you compare against are current.

`change_id_clash` means two open changes on different branches add a
requirement with the same id: both were opened before either clone had fetched
the other's branch. `propose --from-ticket` fetches `origin` before it reserves
ids, so this needs two tickets opened within seconds of each other. Renumber
the one whose branch is not merged yet, in its delta and in the tests that
name it.

`change_base_moved` means a requirement your change modifies or removes has
changed since your delta was written: usually the other ticket of a
`change_overlap` merged first. Archiving your delta as it is would replace the
requirement with your rewrite of the old text, and the other ticket's rule
would be lost without a conflict, so `archive` refuses. Bring the base into
your branch, rewrite the requirement in your delta over the text as it reads
now, keeping what the other change added, then run
`specgate change validate <change> --rebased` to record the new text. The
first `check` or `change validate` that sees a change records what it
rewrites, in `based_on` in its `change.yaml`.

A git conflict in `docs/specs/capabilities/<name>/spec.md` with markers around
whole requirements means both branches rewrote that requirement. Write it as
it should read with both changes, delete the markers and run `specgate check`.
If the conflict covers the whole file instead, this clone has not registered
the merge driver: `specgate doctor` says so, and `specgate harness init`
registers it.

`alm_config_unread_key` means a key in `alm.config.yaml` that your provider
does not read. The message names the provider that would; see
[every key](alm.md#every-key).

## Harness

The **harness** (`specgate harness run`) builds requirements with an agent,
unattended, one git worktree per requirement. See [The harness](harness.md).

| Code or symptom                                    | Cause                                                   | Fix                                                                 |
| -------------------------------------------------- | ------------------------------------------------------- | ------------------------------------------------------------------- |
| `requirement_scenario_unrunnable`                  | The requirement's scenario cannot run yet               | Write its feature file and steps first                              |
| The attempt ended at `write-scope`                 | The agent edited the specification it is judged against | Nothing to do: the attempt is refused; fix the prompt if it repeats |
| The attempt ended at `no-op`                       | The agent wrote no file                                 | Check the agent's write permissions and its command                 |
| `agent_rewrote_gate_command`                       | The agent changed the script your test command runs     | Refused; the gate command is part of the contract                   |
| The first attempt is spent installing dependencies | A new worktree has no `node_modules`                    | Leave the default `--setup-cmd`, or set your install command        |
| A `harness/REQ-…` branch already exists            | An earlier run                                          | `--resume` to continue it, or `--force` to start over               |
| `quality check: <name>` failed                     | A [quality check](quality.md) found something new       | Read its findings; take the baseline if it is old debt              |
| `Docker is not running here`                       | A quality check runs in Docker, or the tests use Testcontainers; `harness run` and the studio's Build stop before any agent | Start Docker Desktop, or the daemon                                 |
| `the tests need Docker, which they could not reach` | Docker stopped while the tests ran                      | Start Docker Desktop and run it again: the agent is not asked       |
| The studio's Build says files are uncommitted      | Work in progress outside the specification              | Commit or stash it; the studio commits only the specification       |
| The studio says the folder holds files             | Its new-project step only uses an empty folder          | `specgate init` adopts the folder, keeping its files                |

### When another attempt cannot help

The harness stops at the first failure no retry can fix: the agent out of
quota or rate-limited; a gate failing only on files the agent may not edit (a
person fixes the specification; "Nothing proves" is still retried, because a
test fixes it); a requirement waiting for an answer. At the `--timeout`
(1200 seconds by default) the agent and everything it started are stopped.
`specgate harness init` puts the build in the gate when there is one: passing
tests with a broken build do not count as delivered.

## CI

| Symptom                                          | Cause                                                  | Fix                                                                                      |
| ------------------------------------------------ | ------------------------------------------------------ | ---------------------------------------------------------------------------------------- |
| A pull request was merged while the gate was red | The CI job is not a required check                     | Protect the base branch: [require the check](first-pr.md#make-the-gate-a-required-check) |
| CI changed behaviour after a Specgate release    | It should not: `specgate ci init` pins the version     | After upgrading the package, run `specgate ci init --force` to move the pin              |
| CI "runs no tests"                               | No test command was set or detected when `ci init` ran | `specgate config set test_cmd "<command>"`, then `specgate ci init --force`              |
| `matrix_stale` only in CI                        | The regenerated matrix was not committed               | Run `specgate check` locally and commit `traceability.md`                                |

## Agents

| Symptom                                            | Cause                                 | Fix                                                                 |
| -------------------------------------------------- | ------------------------------------- | ------------------------------------------------------------------- |
| The agent does not know the `/specgate:*` commands | They were not installed for that tool | `specgate agents init --tool <name>`                                |
| `agents init` left a file as it was                | Existing files are never overwritten  | `specgate agents init --force`, after checking what you would lose  |
| The agent edits the spec or a test to get to green | It treats the contract as code        | Point it at `AGENTS.md`; the harness refuses such an attempt anyway |

See [Agents](agents.md) and [Choosing and wiring your agent](agent-setup.md).

## Domain packs

| Symptom                                       | Cause                               | Fix                                                                                      |
| --------------------------------------------- | ----------------------------------- | ---------------------------------------------------------------------------------------- |
| `expand` leaves `{{VARS}}` in generated files | A required `--var` was not passed   | Run it again with the variable; see `variables.required` in `pack.yaml`                  |
| `pack lint` rejects a pack that worked before | A newer schema requires more fields | Read the error from the latest version: `npx @rsaglobaltech/specgate@latest pack lint …` |

See [Domain packs](domain-packs.md).

## Still stuck

Open an issue with the output of `specgate doctor`, the failing command, its
full output and your Specgate version (`specgate --version`).

## Next

- [What the gate checks](validating.md)
- [Frequently asked questions](faq.md)
