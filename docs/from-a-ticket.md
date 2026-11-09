# From a Jira ticket

At the end of this page, a story in Jira becomes a reviewed change, built and
merged through one pull request, and the ticket moves across the board on its
own. The first half is the one-time setup a team lead does; the second half is
the loop the team runs for every ticket.

## What you get

An analyst writes a story with acceptance criteria. Specgate reads it, never
writes to it, and uses it as the source text of a **change**: a folder that
holds the requirements and scenarios being added, checked against the ticket
(new to these words? see [Concepts](concepts.md#vocabulary)).

```
KAN-13 in Jira (To Do)
  → specgate propose --from-ticket KAN-13       branch feature/KAN-13-… pushed   → In Progress
  → the agent drafts the change against the ticket's acceptance criteria
  → a person reviews the draft
  → build: by hand with specgate apply, or with specgate harness run --chain
  → specgate archive kan-13-register-vehicle-entry     on the branch, before the PR
  → specgate alm pr kan-13-register-vehicle-entry      one pull request "KAN-13 …"  → In Review
  → CI runs the gate; a reviewer approves; merge                                    → Done
```

| Who       | Does                                                                             |
| --------- | -------------------------------------------------------------------------------- |
| Analyst   | Writes the story in Jira and fixes what the ticket check reports                 |
| Team lead | Does the one-time setup below; reviews drafts, or names who does                 |
| Developer | Opens the change, builds it (or runs the harness), archives it and opens the PR  |
| Agent     | Drafts the requirements and scenarios from the ticket; can build them unattended |

Jira moves the ticket through its own Automation rules, from what GitHub tells
it. Specgate itself only reads Jira.

## Prerequisites

- A project that already uses Specgate (`specgate init`), with a test command
  set (`specgate config set test_cmd "npm test"`) and the gate in CI
  (`specgate ci init`). See [Your team's first PR](first-pr.md).
- Jira Cloud, with permission to edit the project's workflow and automation.
- A GitHub repository you can push to, with admin rights for branch protection.
- An agent tool (Claude Code, OpenCode, Cursor, Codex…) to write the draft
  ([Agents](agents.md)).

## One-time setup

Do these steps in this order. Steps 5 and 6 must be finished before anyone
pushes the first ticket branch.

### 1. A Jira API token

1. In your Atlassian account, under **Security → API tokens**, create a token
   **with scopes**, for Jira, with the single scope `read:jira-work`. Specgate
   needs nothing else, because it only reads.
2. Keep it out of the repository: in your shell environment, in your system
   keychain, or as a masked secret in CI. Store the account's email next to it.

```bash
export JIRA_TOKEN="$(security find-generic-password -s jira-token -w)"   # macOS keychain
export JIRA_USER="lead@your-company.com"
```

A token created with scopes works only through Atlassian's API gateway, which
`cloud_id: auto` (step 3) selects. Tokens expire: renew it before that date.

### 2. A GitHub token for `alm pr`

`specgate alm pr` opens the pull request through GitHub's API. Create a
**fine-grained** personal access token with:

- **Repository access:** only this repository.
- **Permissions:** Pull requests, read and write.

Export it in the variable that `pr.token_env` names (`GITHUB_TOKEN` below). Do
not reuse a broad token such as the one `gh auth token` prints: it can do far
more than open one pull request. Pushing the branch does not use this token; it
uses your normal git credentials.

### 3. `alm.config.yaml`

Put this file at the project root and commit it. It names environment
variables, never their values. Every key is described in
[the configuration reference](alm.md#every-key).

```yaml
alm_version: 1
provider: jira
base_url: https://your-site.atlassian.net
project_key: KAN # only keys of this project are read
token_env: JIRA_TOKEN # the variable that holds the API token
user_env: JIRA_USER # the variable that holds the account's email
cloud_id: auto # required for a token created with scopes
acceptance_field: customfield_10050 # only if criteria live in their own field
epics: # which capability each epic's stories belong to
  KAN-5: entry-exit
  KAN-6: invoicing
pr: # for specgate alm pr
  provider: github
  repo: your-org/your-repo
  base: develop # the branch pull requests target
  token_env: GITHUB_TOKEN
```

A **capability** is one area of the specification, such as `invoicing`. A story
whose epic is not under `epics:` needs `--capability <name>` when you open it.

### 4. The GitHub for Jira app

Install the _GitHub for Jira_ app from the Atlassian Marketplace and connect
your GitHub organisation. It shows, inside each ticket, every branch, commit
and pull request whose name or message carries the ticket's key, and it gives
Jira Automation the triggers used in step 6.

### 5. The Jira workflow

The project's workflow needs four statuses: **To Do**, **In Progress**, **In
Review** and **Done**. Make each one reachable from any status (in the workflow
editor, tick _Allow all statuses to transition to this one_). Without that, the
"pull request created" rule fails for a ticket that is still in To Do, because
there is no transition from To Do straight to In Review.

### 6. The automation rules

In **Project settings → Automation**, create these rules before the first
ticket branch exists. A branch pushed before its rule existed never fires it.

| When (trigger)       | If (condition)  | Then (action)             |
| -------------------- | --------------- | ------------------------- |
| Branch created       | —               | Transition to In Progress |
| Commit created       | Status is To Do | Transition to In Progress |
| Pull request created | —               | Transition to In Review   |
| Pull request merged  | —               | Transition to Done        |

The commit rule is a safety net: it moves a ticket whose branch event was
missed.

### 7. Branch protection

The gate only blocks a merge when GitHub is told to wait for it. In
**Settings → Branches**, add a rule for the base branch (and for `main`):
require a pull request, and require the status check of the job
`specgate ci init` wrote (`spec-gate`) to pass. Without this, a red pull
request can still be merged.

### 8. A smoke test with one ticket

Pick one small story and run the daily loop below once. Check that the ticket
shows the branch and moves to In Progress, that the pull request appears in it
and moves it to In Review, and that the merge moves it to Done. Fix any step
that did not fire before the whole team starts.

## Is the ticket ready?

You can send this section to your analysts as it is.

```bash
specgate propose --from-ticket KAN-13 --check
```

This reads the ticket and writes nothing. It looks for four parts in the
description:

- **The intent:** the "As a … I want … so that …" text.
- **The source:** a `Source:` line, when the story comes from a document.
- **The acceptance criteria:** under "Acceptance Criteria", "Akzeptanzkriterien"
  or "Criterios de aceptación", ideally one "Given …, when …, then …" item per
  criterion. A board that keeps criteria in a field of their own sets
  `acceptance_field`.
- **The open questions:** under "Open questions", "Offene Fragen" or "Preguntas
  abiertas", each followed by `Assumption: …`.

Then it checks the ticket against a Definition of Ready, the T-rules. An error
must be fixed before a change can be opened; a warning is for you to judge.
Every fix is something to do in Jira, so nobody needs Specgate to act on it.

| Rule                  | Level   | What it finds                                                    | The fix, in Jira                                        |
| --------------------- | ------- | ---------------------------------------------------------------- | ------------------------------------------------------- |
| `T1_no_criteria`      | error   | No acceptance criteria                                           | Add "Acceptance Criteria", one Given/When/Then per item |
| `T2_vague`            | error   | "fast", "user-friendly", "schnell", "rápido"…                    | Say it in values: "within 2 seconds"                    |
| `T8_orphan_subtask`   | error   | A sub-task with no parent story                                  | Attach it to its story                                  |
| `ticket_epic`         | error   | The key is an epic                                               | Check and open its stories instead                      |
| `T3_unmeasured`       | warning | A promised quantity ("response time", "scalable") with no number | Give the number and its unit                            |
| `T4_technical`        | warning | A criterion that names a technology                              | Say what the user or the business sees                  |
| `T5_too_big`          | warning | More than 8 criteria                                             | Split the story                                         |
| `T6_test_instruction` | warning | A criterion that prescribes tests ("unit tests cover…")          | Write each case it lists as a criterion of its own      |
| `T7_not_behaviour`    | warning | Every criterion is a deliverable (Figma, wireframes, reviewed)   | Track it on the board; it is not behaviour to specify   |
| `T9_open_question`    | note    | A question with no stated assumption                             | Add "Assumption: …" after it                            |

No API access? Export the issue as JSON and pass `--from-ticket KAN-13.json`.

## The daily loop, per ticket

1. See what is next: `specgate status` lists what is open and names the next
   command. In a project configured for Jira with nothing open, that is
   `specgate propose --from-ticket <KEY> --check`.
2. Check the ticket: `specgate propose --from-ticket KAN-13 --check`.
3. Open the change, from a clean working tree:
   `specgate propose --from-ticket KAN-13`. It creates
   `feature/KAN-13-register-vehicle-entry` (`bugfix/…` for a Bug) from
   `pr.base` or the branch you are on, opens the change, commits it and pushes
   the branch: the ticket moves to In Progress, and every clone sees the ids
   it reserved. `--no-push` keeps it local; `--no-branch` keeps your branch.
4. Have the agent draft it:
   `specgate propose --from-ticket KAN-13 --agent "claude -p"`. Run
   `specgate propose --from-ticket KAN-13` until it says **Ready to review**.
   The agent may write only inside the change, never the ticket's copy.
5. A person reviews the draft against `ticket.md`: one requirement per
   criterion, scenarios with the ticket's own values, `questions.md` answered.
   Then commit it, so the build starts from it:
   `git add -A && git commit -m "KAN-13 draft the change"`.
6. Build each requirement. By hand: write the test first and name the
   requirement in it (`REQ-151`), write the code, then `specgate apply REQ-151`
   and commit. `apply` does not commit. Or let the harness build them
   unattended, one requirement at a time, merging each green one into this
   branch; it commits for you, as `KAN-13 REQ-151: …`
   (setup: [The harness](harness.md)):

   ```bash
   specgate harness run --chain --agent "claude -p < {prompt_file}"
   ```

7. Archive the change on the branch, run the gate, commit:

   ```bash
   specgate archive kan-13-register-vehicle-entry
   specgate check
   git add -A && git commit -m "KAN-13 archive the change"
   ```

8. Open the pull request, which moves the ticket to In Review:
   `specgate alm pr kan-13-register-vehicle-entry`. It pushes the branch and
   opens one pull request against `pr.base`, titled "KAN-13 Register vehicle
   entry", listing each requirement and whether `specgate check` passes. Run
   again, it updates the same pull request; it never merges
   ([details](alm.md#open-a-ticket-s-pull-request-alm-pr)).
9. CI runs the gate; a reviewer approves; you merge. The ticket moves to Done.

**Every commit message starts with the ticket key**: `KAN-13 REQ-151: normalize
plates`. Jira shows a commit only when its message names the key, so on a
ticket's branch `specgate check` warns `ticket_key_missing` for each commit
since the base that does not. Do not use Smart Commit commands such as `#done`:
they write to Jira.

## When the ticket changes

`ticket.md`, the copy taken when the change was opened, is the record of what
was agreed. If the analyst edits the ticket later,
`specgate propose --from-ticket KAN-13 --check` reports `ticket_changed`, with the lines removed and added. Decide with the
analyst whether the change follows. If it does, update the delta and
`ticket.md` together, in one commit that names the key.

Never edit `ticket.md` to make a value fit. Its hash is recorded when it is
read, so an edited copy is reported as `ticket_copy_edited` and the draft is
no longer ready. Restore it with `git checkout -- ticket.md`.

## Troubleshooting

| Symptom                                     | Cause                                                     | Fix                                                                    |
| ------------------------------------------- | --------------------------------------------------------- | ---------------------------------------------------------------------- |
| A search finds nothing, or Jira answers 401 | A token created with scopes, sent to the site             | Set `cloud_id: auto`; check the scope `read:jira-work`                 |
| The ticket never moved to In Progress       | The rule was created after the branch was pushed          | Move it by hand; the commit rule catches the next commit               |
| The "pull request created" rule fails       | No transition from the ticket's status into In Review     | Allow all statuses to transition to In Review                          |
| A pull request was merged while CI was red  | No branch protection                                      | Require the `spec-gate` check on the base branch                       |
| Commits are missing from the ticket         | Their messages do not name the key (`ticket_key_missing`) | Reword them to start with the key                                      |
| `ticket_copy_edited`                        | `ticket.md` was changed after it was read                 | `git checkout -- ticket.md`; use `--check` to see what changed in Jira |
| `alm pr` refuses: uncommitted changes       | The pull request would not hold them                      | Commit them, starting with the key, and run it again                   |
| `alm pr`: git push failed                   | Your git credentials for `origin`                         | Fix them so a plain `git push` works                                   |
| `alm pr`: variable not set, or HTTP 401/403 | No GitHub token, or one without Pull requests write       | Export the token `pr.token_env` names (setup step 2)                   |
| `ticket_epic`                               | You passed an epic's key                                  | Open its stories, one change each                                      |
| `ticket_bad_key`                            | An exported file whose key is not like `KAN-13`           | Export the issue from Jira again                                       |
| `ticket_no_capability`                      | The story's epic is not under `epics:`                    | Map the epic, or pass `--capability <name>`                            |
| `ticket_not_ready`                          | The ticket has T-rule errors                              | Fix them in Jira; `--check` lists them                                 |
| Branch not created                          | Uncommitted changes in the working tree                   | Commit them, then run the command again                                |

More, by symptom and by code: [Troubleshooting](troubleshooting.md).

## Reference

**What a ticket's change contains**, under `docs/specs/changes/<key>-<slug>/`:

| File                         | What it holds                                                            |
| ---------------------------- | ------------------------------------------------------------------------ |
| `ticket.md`                  | The ticket as read, unedited, with its link and the time it was read     |
| `proposal.md`                | The intent, quoted, and `ticket: KAN-13`                                 |
| `questions.md`               | The ticket's open questions, with the analyst's assumption as the answer |
| `DRAFTING.md`                | The criteria as the scope and their values as the only values to use     |
| `specs/<capability>/spec.md` | The delta: the requirements and scenarios to write                       |
| `change.yaml`                | The reserved requirement ids, the ticket key and the hash of `ticket.md` |

**Two ways to connect Jira; pick one per project.** This page is the
read-only way. The other, `specgate alm sync`, writes to Jira: an issue per
requirement, closed when it is done ([compare them](alm.md)). The design
decision is [ADR-0039](specs/adr/0039-the-ticket-as-source-text.md).

## Next

- [An existing codebase, with work in Jira](existing-project-with-jira.md)
- [Jira, Azure Boards and GitHub: every configuration key](alm.md)
