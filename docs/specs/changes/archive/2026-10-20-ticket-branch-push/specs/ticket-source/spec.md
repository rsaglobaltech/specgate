# Delta — ticket-source

## MODIFIED Requirements

### Requirement: REQ-148 — The ticket key travels with the work

The system SHALL, when `specgate propose --from-ticket <KEY>` opens a change in a git repository with no uncommitted changes, create and check out the branch `feature/<KEY>-<slug>`, or `bugfix/<KEY>-<slug>` for a ticket of type Bug, from the base branch, unless `--no-branch` is given; SHALL then push that branch to `origin` and set it as upstream, unless `--no-push` is given or there is no `origin`, so a Git host linked to Jira shows the ticket's branch — and a Jira automation can move the ticket — as soon as work starts, saying so when the push fails without undoing the change; SHALL, on `specgate check` in a change's branch, warn with `ticket_key_missing` for each commit since the base branch whose message does not contain the change's ticket key; and SHALL, on `--check` for a ticket whose change already exists, report `ticket_changed` with the lines that differ from `ticket.md`.

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

<!-- specgate:trace status=Implemented feature=features/ticket-source/REQ-148.feature test=tests/unit/ticket-source.test.ts actor=Developer kind=functional -->
