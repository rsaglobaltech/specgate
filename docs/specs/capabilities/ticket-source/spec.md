# Ticket Source

## Purpose

A Jira ticket with acceptance criteria as the source text of a change: read
with the credentials organisations issue today, checked as a Definition of
Ready, drafted and checked against its own words, and carried by its key into
the branch, the commits and one pull request.

## Requirements

### Requirement: REQ-143 — Jira is searched through the enhanced search API

The system SHALL search Jira Cloud through `GET /rest/api/3/search/jql`, asking for at most 100 issues a page and following `nextPageToken` until a page says `isLast` or carries no token, and SHALL stop after 1000 issues with a warning naming the limit, instead of calling `/rest/api/3/search`.

#### Scenario: SCN-143a — Two pages of labelled issues

- GIVEN a Jira that answers HTTP 410 on `/rest/api/3/search` and returns KAN-13 on a first `/rest/api/3/search/jql` page with a `nextPageToken`, and KAN-16 on a second page marked `isLast`
- WHEN the developer runs `specgate alm pull --label spec-driven --dry-run`
- THEN it lists KAN-13 and KAN-16, and no request went to `/rest/api/3/search?`

<!-- specgate:trace actor=Developer feature=features/ticket-source/REQ-143.feature kind=functional status=Implemented test=tests/unit/ticket-source.test.ts -->

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

<!-- specgate:trace actor=Developer feature=features/ticket-source/REQ-144.feature kind=functional status=Implemented test=tests/unit/ticket-source.test.ts -->

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

<!-- specgate:trace actor=Developer feature=features/ticket-source/REQ-145.feature kind=functional status=Implemented test=tests/unit/ticket-source.test.ts -->

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

<!-- specgate:trace actor=Developer feature=features/ticket-source/REQ-146.feature kind=functional status=Implemented test=tests/unit/ticket-source.test.ts -->

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

<!-- specgate:trace actor=Developer feature=features/ticket-source/REQ-147.feature kind=functional status=Implemented test=tests/unit/ticket-source.test.ts -->

### Requirement: REQ-148 — The ticket key travels with the work

The system SHALL, when `specgate propose --from-ticket <KEY>` opens a change in a git repository with no uncommitted changes, create and check out the branch `feature/<KEY>-<slug>`, or `bugfix/<KEY>-<slug>` for a ticket of type Bug, from the base branch — `pr.base` in `alm.config.yaml` when it names a branch that exists, otherwise the current branch when it is not another ticket's branch, otherwise the remote's default branch — unless `--no-branch` is given; SHALL then push that branch to `origin` and set it as upstream, unless `--no-push` is given or there is no `origin`, so a Git host linked to Jira shows the ticket's branch — and a Jira automation can move the ticket — as soon as work starts, saying so when the push fails without undoing the change; SHALL, on `specgate check` in a change's branch, warn with `ticket_key_missing` for each commit since the base branch (`pr.base` when set, otherwise as for `--base`) whose message does not contain the change's ticket key; and SHALL, on `--check` for a ticket whose change already exists, report `ticket_changed` with the lines that differ from `ticket.md`.

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

#### Scenario: SCN-148d — The branch is on the host as soon as work starts

- GIVEN a clean git repository whose `origin` is reachable, and the exported KAN-13
- WHEN the developer runs `specgate propose --from-ticket KAN-13.json --capability entry-exit`
- THEN `origin` has the branch `feature/KAN-13-register-vehicle-entry`, and the local branch tracks it

#### Scenario: SCN-148e — Gitflow: the ticket's branch starts from develop

- GIVEN a clone whose remote's default branch is `main`, where the developer is on `develop`, which has commits `main` lacks, and `alm.config.yaml` names `pr.base: develop`
- WHEN the developer runs `specgate propose --from-ticket KAN-13.json --capability entry-exit`
- THEN the branch `feature/KAN-13-register-vehicle-entry` starts from `develop`, and `specgate check` on it warns `ticket_key_missing` for none of `develop`'s commits

<!-- specgate:trace actor=Developer feature=features/ticket-source/REQ-148.feature kind=functional status=Implemented test=tests/unit/ticket-source.test.ts -->

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

<!-- specgate:trace actor=Developer feature=features/ticket-source/REQ-149.feature kind=functional status=Implemented test=tests/unit/ticket-source.test.ts -->

### Requirement: REQ-150 — From a Jira ticket, documented

The system SHALL document the ticket path on a page `docs/from-a-ticket.md` — when to use a ticket and when a brief, the `alm.config.yaml` it needs with token variables only, the Definition of Ready with every T-rule and its fix, the flow from `--check` to `alm pr`, and how the key shows the branch, commits and pull request in Jira — and SHALL list `propose --from-ticket` and `alm pr` in `specgate propose --help`, `specgate alm --help` and `docs/commands.md`.

#### Scenario: SCN-150a — The page and the help agree

- GIVEN the documentation of this version
- WHEN the developer reads `docs/from-a-ticket.md` and runs `specgate propose --help`
- THEN the page names T1 to T9 and `cloud_id: auto`, and the help lists `--from-ticket`

<!-- specgate:trace actor=Developer feature=features/ticket-source/REQ-150.feature kind=functional status=Implemented test=tests/unit/ticket-source.test.ts -->

### Requirement: REQ-153 — A monorepo's stack is read from its apps

The system SHALL, when `specgate adopt` or `specgate init` reads the stack of a project whose root `package.json` declares workspaces, also read the build manifest (`pom.xml`, `build.gradle`, `build.gradle.kts`, `package.json`, `go.mod`, `pyproject.toml`) of each directory under `apps/`, `services/` and `backend/`, and SHALL write in `AGENTS.md` one stack per such directory that has one — naming the directory — joined with " + ", and the testing tools of each, instead of the root's Node.js alone.

#### Scenario: SCN-153a — A Spring API and a Next.js web app

- GIVEN a project whose root `package.json` declares workspaces, with `apps/api/pom.xml` using Spring Boot and Testcontainers, and `apps/web/package.json` using `next` and TypeScript
- WHEN the developer runs `specgate adopt --no-capabilities`
- THEN the `AGENTS.md` stack line names "Spring Boot" with "(apps/api)" and "next" with "(apps/web)", and its testing names JUnit 5 and Testcontainers

<!-- specgate:trace actor=Developer feature=features/ticket-source/REQ-153.feature kind=functional status=Implemented test=tests/unit/ticket-source.test.ts -->

### Requirement: REQ-154 — The agent contract names the ticket path

The system SHALL write in every `AGENTS.md` it generates, within its length budget, a section "From a brief or a Jira ticket" saying that `specgate propose --from-ticket <KEY>` opens the ticket's change on its branch and writes `DRAFTING.md`, that `ticket.md` is never edited, and that every commit message starts with the ticket key and never uses Smart Commit commands.

#### Scenario: SCN-154a — The section is there

- GIVEN a new project
- WHEN the developer runs `specgate adopt --no-capabilities`
- THEN `AGENTS.md` has a section "From a brief or a Jira ticket" naming `specgate propose --from-ticket`, `ticket.md` and the ticket key in commit messages

<!-- specgate:trace actor=Developer feature=features/ticket-source/REQ-154.feature kind=functional status=Implemented test=tests/unit/ticket-source.test.ts -->

### Requirement: REQ-155 — Updating Specgate updates the agent contract

The system SHALL, on `specgate update`, rewrite the Specgate block of `AGENTS.md` from the installed Specgate's template, keeping the facts the block states (project, architecture, domain, stack, API, testing) and its "Project rules" section, and the team's text outside the block unchanged; SHALL do so even when the project has no other generated agent files; SHALL report the block as updated, or unchanged when the template has not changed; and SHALL write nothing with `--dry-run`.

#### Scenario: SCN-155a — A contract from an older Specgate

- GIVEN an adopted project whose `AGENTS.md` block has the section "From a plan or brief", the stack "Java 21, Spring Boot (apps/api)", the project rule "The test command is `npm test`.", and the team's line "Ask Ana before touching billing." below the block, and no other generated agent files
- WHEN the developer runs `specgate update`
- THEN the block has the section "From a brief or a Jira ticket", the stack and the project rule are still there, the team's line is unchanged below the block, and the output names `AGENTS.md` as updated

<!-- specgate:trace actor=Developer feature=features/ticket-source/REQ-155.feature kind=functional status=Implemented test=tests/unit/ticket-source.test.ts -->

### Requirement: REQ-156 — The harness's commits name the ticket

The system SHALL, when `specgate harness run` commits a requirement that an open change opened from a ticket adds or modifies, start the commit message with the ticket key (`KAN-14 REQ-002: …`), and SHALL start the merge commit of `--chain` with it too, so the Git host shows the harness's work in the ticket and `check` does not warn `ticket_key_missing` about it; a requirement of no such change keeps the message it had.

#### Scenario: SCN-156a — A requirement of KAN-14

- GIVEN an open change `kan-14-vehicle-type-catalog` with `ticket: KAN-14` whose delta adds REQ-002
- WHEN the harness commits REQ-002 on its third attempt of three
- THEN the commit message starts "KAN-14 REQ-002: implement via specgate harness"

<!-- specgate:trace actor=Developer feature=features/ticket-source/REQ-156.feature kind=functional status=Implemented test=tests/unit/ticket-source.test.ts -->

### Requirement: REQ-157 — A change reserves its scenario ids as it reserves its requirement ids

The system SHALL, when `propose --from-ticket` or `propose --from-brief <module>` opens a change, reserve three scenario ids per reserved requirement id, starting above every scenario id used or reserved on any branch, record them as `scn_range` in its `change.yaml`, and name that range in its `DRAFTING.md`, so that a change drafted later on another branch starts above it.

#### Scenario: SCN-157a — Two tickets opened before either is drafted

- GIVEN a project where KAN-14's change was opened with `scn_range: [SCN-002, SCN-019]` and not yet drafted
- WHEN the developer opens KAN-13 with `specgate propose --from-ticket KAN-13.json --capability parking`
- THEN KAN-13's `change.yaml` has a `scn_range` starting at SCN-020, and its `DRAFTING.md` names that range

<!-- specgate:trace actor=Developer feature=features/ticket-source/REQ-157.feature kind=functional status=Implemented test=tests/unit/ticket-source.test.ts -->

### Requirement: REQ-158 — Status points a Jira project to its tickets

The system SHALL, when `specgate status` would suggest specifying a first behaviour — no requirement yet, or only the adoption baseline left — and `alm.config.yaml` names the `jira` provider, suggest `specgate propose --from-ticket <KEY> --check` instead of `specgate new`.

#### Scenario: SCN-158a — An adopted project connected to Jira

- GIVEN a freshly adopted project with `alm.config.yaml` naming `provider: jira`
- WHEN the developer runs `specgate status`
- THEN the next step is `specgate propose --from-ticket <KEY> --check`

<!-- specgate:trace actor=Developer feature=features/ticket-source/REQ-158.feature kind=functional status=Implemented test=tests/unit/ticket-source.test.ts -->

### Requirement: REQ-159 — The pull request carries the archived change

The system SHALL, on `specgate alm pr <change>`, find the change under `docs/specs/changes/archive/` — the most recent `<date>-<change>` — when it is no longer open, so the ticket's pull request can carry its archive; and SHALL, when `specgate archive` archives a change opened from a ticket, name `specgate alm pr <change>` as the next step instead of the brief's next module.

#### Scenario: SCN-159a — Archived before its pull request

- GIVEN the branch `feature/KAN-13-register-vehicle-entry` whose change `kan-13-register-vehicle-entry` is archived as `2026-10-20-kan-13-register-vehicle-entry`, and a GitHub with no open pull request for it
- WHEN the developer runs `specgate alm pr kan-13-register-vehicle-entry`
- THEN one pull request is created titled "KAN-13 Register vehicle entry", whose body lists the change's requirements

<!-- specgate:trace actor=Developer feature=features/ticket-source/REQ-159.feature kind=functional status=Implemented test=tests/unit/ticket-source.test.ts -->

### Requirement: REQ-161 — A German or accented summary makes a readable change id

The system SHALL, when it makes a change id and a branch name from a ticket's summary, write `ß` as `ss`, `ä`, `ö`, `ü` as `ae`, `oe`, `ue` (and their capitals), and drop other accents to their base letter, before it keeps letters and digits.

#### Scenario: SCN-161a — "Groß" becomes "gross" in the change id

- GIVEN the exported PET-101 with the summary "Suche ignoriert Groß-/Kleinschreibung nicht"
- WHEN the developer runs `specgate propose --from-ticket PET-101.json --capability owners --no-branch`
- THEN the change is `pet-101-suche-ignoriert-gross-kleinschreibung-nicht`

<!-- specgate:trace actor=Developer feature=features/ticket-source/REQ-161.feature kind=functional status=Implemented test=tests/unit/ticket-source.test.ts -->

### Requirement: REQ-162 — OpenCode gets the loop's commands

The system SHALL, on `specgate agents init --tool opencode`, and by default when the project has a `.opencode` folder or an `opencode.json`, write one command per step of the daily loop as `.opencode/commands/specgate-<step>.md` — a description in its front matter and the step's commands with `$ARGUMENTS` where the step takes an argument — and the agent contract in `AGENTS.md`, which OpenCode reads; and SHALL list `opencode` among the tools in `specgate agents init --help`.

#### Scenario: SCN-162a — A project that uses OpenCode

- GIVEN a project with an `opencode.json` and no agent files
- WHEN the developer runs `specgate agents init --tool opencode`
- THEN `.opencode/commands/specgate-draft.md` exists, starts with front matter naming a description, runs `specgate propose --from-brief $ARGUMENTS`, and `AGENTS.md` exists

<!-- specgate:trace actor=Developer feature=features/ticket-source/REQ-162.feature kind=functional status=Implemented test=tests/unit/ticket-source.test.ts -->
