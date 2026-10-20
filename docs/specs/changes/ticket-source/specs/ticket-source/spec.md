# Delta — ticket-source

## Purpose

A Jira ticket with acceptance criteria as the source text of a change: read
with the credentials organisations issue today, checked as a Definition of
Ready, drafted and checked against its own words, and carried by its key into
the branch, the commits and one pull request.

## ADDED Requirements

### Requirement: REQ-143 — Jira is searched through the enhanced search API

The system SHALL search Jira Cloud through `GET /rest/api/3/search/jql`, asking for at most 100 issues a page and following `nextPageToken` until a page says `isLast` or carries no token, and SHALL stop after 1000 issues with a warning naming the limit, instead of calling `/rest/api/3/search`.

#### Scenario: SCN-143a — Two pages of labelled issues

- GIVEN a Jira that answers HTTP 410 on `/rest/api/3/search` and returns KAN-13 on a first `/rest/api/3/search/jql` page with a `nextPageToken`, and KAN-16 on a second page marked `isLast`
- WHEN the developer runs `specgate alm pull --label spec-driven --dry-run`
- THEN it lists KAN-13 and KAN-16, and no request went to `/rest/api/3/search?`

<!-- specgate:trace status=Implemented feature=features/ticket-source/REQ-143.feature test=tests/unit/ticket-source.test.ts actor=Developer kind=functional -->

### Requirement: REQ-144 — Scoped tokens reach Jira through the gateway

The system SHALL, when `alm.config.yaml` sets `cloud_id` to a site id or to `auto`, send every Jira API request to `https://api.atlassian.com/ex/jira/<cloud id>`, resolving `auto` once from the unauthenticated `<base_url>/_edge/tenant_info` and sending no credential with that request, while links to issues keep `base_url`; and SHALL, when a request to the site itself is refused with HTTP 401 or answered as anonymous — a response whose `X-Seraph-LoginReason` is `AUTHENTICATED_FAILED`, which Jira returns with HTTP 200 and no issues — fail and name `cloud_id: auto` in the fix, instead of reporting that nothing was found.

#### Scenario: SCN-144a — A scoped token

- GIVEN `alm.config.yaml` with `base_url: https://specgatedemo.atlassian.net` and `cloud_id: auto`, and a site whose `tenant_info` returns cloud id `9e49`
- WHEN the developer runs `specgate alm pull --dry-run`
- THEN the search goes to `https://api.atlassian.com/ex/jira/9e49/rest/api/3/search/jql`, the `tenant_info` request carries no `Authorization` header, and each issue's link starts with `https://specgatedemo.atlassian.net/browse/`

#### Scenario: SCN-144b — A scoped token sent to the site

- GIVEN the same config without `cloud_id`, and a site that answers HTTP 401
- WHEN the developer runs `specgate alm pull --dry-run`
- THEN it exits 1 and the message says to set `cloud_id: auto` for a token created with scopes

#### Scenario: SCN-144c — Answered as anonymous

- GIVEN the same config without `cloud_id`, and a site whose search answers HTTP 200 with no issues and `X-Seraph-LoginReason: AUTHENTICATED_FAILED`
- WHEN the developer runs `specgate alm pull --dry-run`
- THEN it exits 1 naming `cloud_id: auto`, and does not say "No open issues"

<!-- specgate:trace status=Implemented feature=features/ticket-source/REQ-144.feature test=tests/unit/ticket-source.test.ts actor=Developer kind=functional -->

### Requirement: REQ-145 — A ticket is read into its parts

The system SHALL read one issue — from Jira by key, or from a file holding Jira's issue JSON — into its key, summary, type, parent key, labels, intent, source line, acceptance criteria and open questions, taking the criteria from the custom field named by `acceptance_field` when it is set and has text, and otherwise from the description's section under a heading or a line reading "Acceptance criteria", "Akzeptanzkriterien" or "Criterios de aceptación", and the open questions from the section under "Open questions", "Offene Fragen" or "Preguntas abiertas", in any case, with or without a trailing colon, whether the description is Atlassian Document Format or plain text.

#### Scenario: SCN-145a — A story as the analyst wrote it

- GIVEN an exported KAN-18 whose description holds an "As an administrator…" paragraph, a "Source: Spec §2.2" line, five criteria under "Acceptance Criteria" and one question under "Open questions"
- WHEN the developer runs `specgate propose --from-ticket KAN-18.json --check --json`
- THEN the ticket reads with key KAN-18, type Story, five criteria, one question, intent beginning "As an administrator" and source "Spec §2.2"

#### Scenario: SCN-145b — German headings

- GIVEN an exported story whose description has "Akzeptanzkriterien:" and "Offene Fragen" sections
- WHEN the developer runs `specgate propose --from-ticket story.json --check --json`
- THEN the criteria and the questions are read from those sections

<!-- specgate:trace status=Implemented feature=features/ticket-source/REQ-145.feature test=tests/unit/ticket-source.test.ts actor=Developer kind=functional -->

### Requirement: REQ-146 — A ticket is checked against a Definition of Ready

The system SHALL, on `specgate propose --from-ticket <KEY> --check`, check the ticket against rules T1 to T9 without writing any file, listing each finding with its code, the criterion it is about when it has one, and a fix an analyst can apply in Jira, and exit 1 when a finding is an error and 0 otherwise. The errors are `T1_no_criteria` (no criterion), `T2_vague` (a criterion with a vague word, in English, German or Spanish) and `T8_orphan_subtask` (a sub-task with no parent); the warnings are `T3_unmeasured`, `T4_technical`, `T5_too_big` (more than 8 criteria), `T6_test_instruction` (a criterion that prescribes tests instead of behaviour) and `T7_not_behaviour` (a ticket whose every criterion speaks of a deliverable — delivered, documented, reviewed, approved, a design tool, wireframes, mockups, a prototype — instead of what the system does); `T9_open_question` is a note for a question with no stated assumption. An issue of type Epic is not checked against T1 to T9: it is refused with `ticket_epic`, whose fix names the `epics:` map and its stories, since an epic maps to a capability and is not drafted itself.

#### Scenario: SCN-146a — A ticket with no criteria

- GIVEN an exported story whose description is one "As a user…" paragraph
- WHEN the developer runs `specgate propose --from-ticket story.json --check`
- THEN it exits 1, shows `T1_no_criteria` with a fix naming the "Acceptance Criteria" heading, and `git status` shows no change

#### Scenario: SCN-146b — A criterion that prescribes tests

- GIVEN the exported KAN-18, whose fourth criterion reads "when unit tests run, then they cover at least: 0 minutes, exactly 1 hour…"
- WHEN the developer runs `specgate propose --from-ticket KAN-18.json --check`
- THEN it exits 0, shows `T6_test_instruction` for criterion 4, and says "Ready to draft"

#### Scenario: SCN-146c — Vague words in German

- GIVEN an exported story with the criterion "Die Liste lädt schnell und ist benutzerfreundlich"
- WHEN the developer runs `specgate propose --from-ticket story.json --check`
- THEN it exits 1 and shows `T2_vague` naming "schnell" and "benutzerfreundlich"

#### Scenario: SCN-146d — A design deliverable

- GIVEN an exported story whose criteria read "when user flows are delivered, then they cover login" and "when they are reviewed, then the product owner approves them"
- WHEN the developer runs `specgate propose --from-ticket story.json --check`
- THEN it shows `T7_not_behaviour`, whose fix says a deliverable is tracked on the board, not specified

<!-- specgate:trace status=Implemented feature=features/ticket-source/REQ-146.feature test=tests/unit/ticket-source.test.ts actor=Developer kind=functional -->

### Requirement: REQ-147 — A ready ticket opens a change checked against it

The system SHALL, on `specgate propose --from-ticket <KEY>` for a ticket with no T-error, open the change `<key in lower case>-<slug of the summary>` holding `ticket.md` (the ticket as read, unedited, with its key, link and the time it was read), `proposal.md` (the intent quoted, and `ticket: <KEY>`), `questions.md` (one row per open question, its assumption as the provisional answer), `DRAFTING.md` (the criteria as the scope, their values as the only values to use) and a delta under the capability that `epics:` in `alm.config.yaml` maps the ticket's epic to, or that `--capability` names; SHALL record `brief:` as the path of `ticket.md` and its SHA-256 in `change.yaml`, so the D-checklist runs against the ticket; SHALL refuse with `ticket_not_ready` while a T-error remains, and with `ticket_no_capability` when neither names a capability; and SHALL report `ticket_copy_edited` when `ticket.md` no longer matches its SHA-256.

#### Scenario: SCN-147a — KAN-13 opens a change

- GIVEN a Specgate project whose `alm.config.yaml` maps KAN-5 to `entry-exit`, and the exported KAN-13 "Register vehicle entry", child of KAN-5, with six criteria
- WHEN the developer runs `specgate propose --from-ticket KAN-13.json`
- THEN the change `kan-13-register-vehicle-entry` exists with `ticket.md`, `proposal.md` naming `ticket: KAN-13`, `DRAFTING.md` quoting the six criteria, and `specs/entry-exit/spec.md`, and its `change.yaml` names `ticket.md` as `brief:`

#### Scenario: SCN-147b — An epic nobody mapped

- GIVEN the same project with no `epics:` map
- WHEN the developer runs `specgate propose --from-ticket KAN-13.json`
- THEN it exits 1 with `ticket_no_capability`, whose fix names `--capability` and the `epics:` map, and no change is opened

#### Scenario: SCN-147c — The copy edited to pass

- GIVEN the opened `kan-13-register-vehicle-entry`, whose `ticket.md` has since been edited
- WHEN the developer runs `specgate propose --from-ticket KAN-13.json`
- THEN it reports `ticket_copy_edited` as an error and does not say "Ready to review"

<!-- specgate:trace status=Implemented feature=features/ticket-source/REQ-147.feature test=tests/unit/ticket-source.test.ts actor=Developer kind=functional -->

### Requirement: REQ-148 — The ticket key travels with the work

The system SHALL, when `specgate propose --from-ticket <KEY>` opens a change in a git repository with no uncommitted changes, create and check out the branch `feature/<KEY>-<slug>`, or `bugfix/<KEY>-<slug>` for a ticket of type Bug, unless `--no-branch` is given; SHALL, on `specgate check` in a change's branch, warn with `ticket_key_missing` for each commit since the base branch whose message does not contain the change's ticket key; and SHALL, on `--check` for a ticket whose change already exists, report `ticket_changed` with the lines that differ from `ticket.md`.

#### Scenario: SCN-148a — A story becomes a branch

- GIVEN a clean git repository and the exported KAN-13, of type Story
- WHEN the developer runs `specgate propose --from-ticket KAN-13.json --capability entry-exit`
- THEN the current branch is `feature/KAN-13-register-vehicle-entry`

#### Scenario: SCN-148b — A commit without the key

- GIVEN that branch with one commit "KAN-13 REQ-151: normalize plates" and one commit "fix typo"
- WHEN the developer runs `specgate check`
- THEN it warns `ticket_key_missing` for "fix typo" only

#### Scenario: SCN-148c — The analyst changed a criterion

- GIVEN the opened change, and an exported KAN-13 whose second criterion now ends "pre-filled with the current time"
- WHEN the developer runs `specgate propose --from-ticket KAN-13.json --check`
- THEN it reports `ticket_changed` showing the old and the new line

<!-- specgate:trace status=Implemented feature=features/ticket-source/REQ-148.feature test=tests/unit/ticket-source.test.ts actor=Developer kind=functional -->

### Requirement: REQ-149 — One pull request per ticket

The system SHALL, on `specgate alm pr <change>`, push the change's branch and open on GitHub — through the repository, base branch and token variable named under `pr:` in `alm.config.yaml` — one pull request titled `<KEY> <summary>`, whose body links the ticket and the change, lists each requirement of the change with its status, and states whether `specgate check` passes; and SHALL update that pull request's title and body instead of opening a second one when one is already open for the branch. It SHALL never merge, close or delete anything, and never print the token.

#### Scenario: SCN-149a — The first pull request

- GIVEN the branch `feature/KAN-13-register-vehicle-entry` with REQ-151 Implemented, and a GitHub with no open pull request for it
- WHEN the developer runs `specgate alm pr kan-13-register-vehicle-entry`
- THEN one pull request is created titled "KAN-13 Register vehicle entry" against `develop`, whose body names KAN-13, REQ-151 and the result of `specgate check`

#### Scenario: SCN-149b — Run again

- GIVEN that pull request is open
- WHEN the developer runs `specgate alm pr kan-13-register-vehicle-entry` again
- THEN the same pull request is updated and no second one is created

<!-- specgate:trace status=Implemented feature=features/ticket-source/REQ-149.feature test=tests/unit/ticket-source.test.ts actor=Developer kind=functional -->

### Requirement: REQ-150 — From a Jira ticket, documented

The system SHALL document the ticket path on a page `docs/from-a-ticket.md` — when to use a ticket and when a brief, the `alm.config.yaml` it needs with token variables only, the Definition of Ready with every T-rule and its fix, the flow from `--check` to `alm pr`, and how the key shows the branch, commits and pull request in Jira — and SHALL list `propose --from-ticket` and `alm pr` in `specgate propose --help`, `specgate alm --help` and `docs/commands.md`.

#### Scenario: SCN-150a — The page and the help agree

- GIVEN the documentation of this version
- WHEN the developer reads `docs/from-a-ticket.md` and runs `specgate propose --help`
- THEN the page names T1 to T9 and `cloud_id: auto`, and the help lists `--from-ticket`

<!-- specgate:trace status=Draft feature=features/ticket-source/REQ-150.feature test=tests/unit/ticket-source.test.ts actor=Developer kind=functional -->
