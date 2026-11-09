# Delta — ticket-source

## ADDED Requirements

### Requirement: REQ-170 — A ticket's branch may name its team

The system SHALL read a branch named `<feature|bugfix|hotfix>/<team>/<KEY>`, optionally followed by `-<words>`, as the branch of ticket `<KEY>`, wherever it reads a ticket's branch named `<feature|bugfix|hotfix>/<KEY>`.

#### Scenario: SCN-170a — A team's branch is still the ticket's

- GIVEN a branch `feature/parking/KAN-13` with a commit "KAN-13 REQ-151: normalize plates" and a commit "fix typo"
- WHEN the developer runs `specgate check`
- THEN it warns `ticket_key_missing` for "fix typo" only

<!-- specgate:trace status=Implemented test=tests/unit/ticket-source.test.ts actor=Developer kind=functional -->

## MODIFIED Requirements

### Requirement: REQ-165 — Opening a ticket's change publishes its reservation

The system SHALL, when `specgate propose --from-ticket <KEY>` has created the ticket's branch, or when it is given `--no-branch` on a branch that already names `<KEY>`, commit the opened change's folder, and nothing else, on that branch with the message `<KEY> docs(spec): open the change from the ticket`, and push that commit with the branch, unless `--no-push` is given, so the requirement and scenario ids it reserved are visible to every other clone from that moment; and SHALL commit nothing on any other branch.

#### Scenario: SCN-165a — A colleague sees the reservation at once

- GIVEN two clones of one repository, and a colleague who has just opened PET-104 with `specgate propose --from-ticket PET-104.json --capability owners`
- WHEN the developer, in the other clone, runs `git fetch` and looks at the colleague's branch
- THEN that branch holds PET-104's change, with its `req_range`, in a commit "PET-104 docs(spec): open the change from the ticket"

#### Scenario: SCN-165b — Another tool made the branch

- GIVEN a colleague on a branch `feature/clinic/PET-104` that agentkit created, with another file staged, who runs `specgate propose --from-ticket PET-104.json --capability owners --no-branch`
- WHEN the developer, in the other clone, runs `git fetch` and looks at `feature/clinic/PET-104`
- THEN it holds PET-104's change in a commit "PET-104 docs(spec): open the change from the ticket", and the staged file is still staged, not in that commit

<!-- specgate:trace status=Implemented feature=features/ticket-source/REQ-165.feature test=tests/unit/change-overlap.test.ts actor=Developer kind=functional -->
