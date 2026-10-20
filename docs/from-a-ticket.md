# From a Jira ticket

In many organisations the work is already written down, in Jira rather than in
a brief. An analyst writes each story with a description and acceptance
criteria, often in Given/When/Then, and has them reviewed before a sprint takes
the story. This page shows how to use that ticket as the source text of a
change. You need no second document, and Jira is only ever read.

```
KAN-13 in Jira
  → specgate propose --from-ticket KAN-13 --check     is it ready? (T1–T9)
  → specgate propose --from-ticket KAN-13             the change, on feature/KAN-13-…
  → your agent drafts it; a person reviews it
  → specgate apply REQ-…                              test first; commits "KAN-13 REQ-…: …"
  → specgate alm pr kan-13-register-vehicle-entry     one pull request, "KAN-13 …"
  → Jira shows the branch, the commits and the pull request in KAN-13
  → merge, then specgate archive
```

The decision behind it is [ADR-0039](specs/adr/0039-the-ticket-as-source-text.md).

## A ticket or a brief

| You have                                                       | Use                                                |
| -------------------------------------------------------------- | -------------------------------------------------- |
| A story or a bug in Jira, with acceptance criteria             | The ticket: `specgate propose --from-ticket <KEY>` |
| A new product, or a large area of one, described in a document | A brief: [From a client brief](from-a-brief.md)    |
| One behaviour to change, and no ticket                         | `specgate propose <change-id>`                     |

For the checks, a ticket and a brief work the same way. Each is the text the
draft is checked against, so a draft may only use the values its source states.

## 1. Connect Jira

Put `alm.config.yaml` at the project root. It names environment variables,
never their values, so it is safe to commit:

```yaml
alm_version: 1
provider: jira
base_url: https://your-site.atlassian.net
project_key: KAN
token_env: JIRA_TOKEN # holds the API token
user_env: JIRA_USER # holds the account's email
cloud_id: auto # for a token created with scopes
epics: # which capability each epic's stories belong to
  KAN-5: entry-exit
  KAN-6: invoicing
pr: # for specgate alm pr
  provider: github
  repo: your-org/your-repo
  base: develop
  token_env: GITHUB_TOKEN
```

- **Read-only.** Specgate reads one issue at a time, and only keys of
  `project_key`. It never writes a comment, a transition or a field.
- **Scoped tokens.** A token created with scopes is refused by the site itself.
  Jira answers it as an anonymous request, so a search returns nothing. Such a
  token only works through Atlassian's gateway: `cloud_id: auto` reads the
  site's id without sending the token, and from then on every request goes
  through the gateway. The only scope needed is `read:jira-work`.
- **Keep tokens out of the repository.** Keep them in the environment, or in
  your system's keychain, and pass them in when you run the command. In CI,
  store them as masked secrets.
- **No API access?** Export the issue as JSON and pass the file:
  `--from-ticket KAN-13.json`.

## 2. Is the ticket ready?

```bash
specgate propose --from-ticket KAN-13 --check
```

This reads the ticket and writes nothing. It finds the parts:

- **The intent:** the "As a … I want … so that …" text.
- **The source:** a `Source:` line.
- **The acceptance criteria:** under "Acceptance Criteria", "Akzeptanzkriterien"
  or "Criterios de aceptación". If the board keeps criteria in a field of their
  own, name it as `acceptance_field: customfield_10050`.
- **The open questions:** under "Open questions", "Offene Fragen" or "Preguntas
  abiertas". Each can be followed by `Assumption: …`.

Then it checks the ticket against a Definition of Ready. Every fix is written
for the person who edits the ticket in Jira, so an analyst can use the report
without using Specgate.

| Rule                  | Level   | What it finds                                                                   | The fix, in Jira                                                                         |
| --------------------- | ------- | ------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| `T1_no_criteria`      | error   | No acceptance criteria                                                          | Add an "Acceptance Criteria" line, with one "Given …, when …, then …" item per criterion |
| `T2_vague`            | error   | "fast", "user-friendly", "schnell", "benutzerfreundlich", "rápido"…             | Say what it means in values: "within 2 seconds"                                          |
| `T8_orphan_subtask`   | error   | A sub-task with no parent story                                                 | Attach it to its story                                                                   |
| `T3_unmeasured`       | warning | A promised quantity ("response time", "scalable") with no number                | Give the number and its unit                                                             |
| `T4_technical`        | warning | A criterion that names a technology                                             | Say what the user or the business sees                                                   |
| `T5_too_big`          | warning | More than 8 criteria                                                            | Split the story                                                                          |
| `T6_test_instruction` | warning | A criterion that prescribes tests ("unit tests cover…")                         | Write each case it lists as a criterion of its own                                       |
| `T7_not_behaviour`    | warning | Every criterion is about a deliverable (delivered, reviewed, Figma, wireframes) | Track it on the board; leave it out of the spec                                          |
| `T9_open_question`    | note    | A question with no stated assumption                                            | Add "Assumption: …"                                                                      |
| `ticket_epic`         | error   | The key is an epic                                                              | Map the epic under `epics:` and draft its stories                                        |

On a board of 54 real stories, these rules found 2 test instructions, 1
unmeasured promise, 3 design deliverables and 3 questions without an
assumption. Nothing else needed a fix.

## 3. Open the change

```bash
specgate propose --from-ticket KAN-13
```

From a clean working tree this creates the branch
`feature/KAN-13-register-vehicle-entry` (`bugfix/…` for a bug), and opens the
change `kan-13-register-vehicle-entry` on it:

| File                         | What it holds                                                                                 |
| ---------------------------- | --------------------------------------------------------------------------------------------- |
| `ticket.md`                  | The ticket as read, unedited, with its link and the time it was read                          |
| `proposal.md`                | The intent, quoted, and `ticket: KAN-13`                                                      |
| `questions.md`               | The ticket's open questions, the analyst's assumption as the answer                           |
| `DRAFTING.md`                | The criteria as the scope and their values as the only values to use: what your agent follows |
| `specs/<capability>/spec.md` | The delta to write, for the capability the epic maps to (or `--capability`)                   |

`change.yaml` names `ticket.md` as the draft's source and records its SHA-256.
If the copy is edited, for example by an agent trying to make a value appear,
the result is `ticket_copy_edited` and the draft is not ready.

Have your agent write it, or let Specgate call the agent:

```bash
specgate propose --from-ticket KAN-13 --agent "claude -p"
```

The agent can write only inside the change, and never `ticket.md`. The text of
a ticket is data to specify, not instructions to the agent. Run the command
again until it says **Ready to review**. A person then reviews the draft.

## 4. Build it, with the key in every commit

Deliver each requirement as usual, test first, then `specgate apply REQ-…`.
Start every commit message with the key: `KAN-13 REQ-151: normalize plates`.
Jira shows a commit in the ticket only when the message names the key, so on a
ticket's branch `specgate check` warns `ticket_key_missing` for every commit
since the base branch that does not.

Do not use Smart Commit commands (`#comment`, `#done`): they write to Jira.

## 5. One pull request per ticket

```bash
specgate alm pr kan-13-register-vehicle-entry
```

This pushes the branch and opens one pull request against `pr.base`:

- **The title** is "KAN-13 Register vehicle entry".
- **The body** links the ticket and the change, lists every requirement with
  its status, and says whether `specgate check` passes. The command runs the
  check itself; `--no-check` skips it and the body says so.

Running it again updates the same pull request. It never merges, closes or
deletes anything.

To make the gate block the merge on GitHub, run `specgate check` in CI and make
that job a required status check on the base branch.

## When the ticket changes

The copy is the record of what was agreed. If the analyst edits the ticket
later, run the check again:

```bash
specgate propose --from-ticket KAN-13 --check
```

It reports `ticket_changed` with the old and new lines. You and the analyst
decide whether the change follows. If it does, update the delta and
`ticket.md` together, in one commit that names the ticket.
