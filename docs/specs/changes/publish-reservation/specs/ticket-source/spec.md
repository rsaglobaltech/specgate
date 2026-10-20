# Delta — ticket-source

## ADDED Requirements

### Requirement: REQ-165 — Opening a ticket's change publishes its reservation

The system SHALL, when `specgate propose --from-ticket <KEY>` has created the ticket's branch, commit the opened change on it with the message `<KEY> docs(spec): open the change from the ticket` and push that commit with the branch, unless `--no-push` is given, so the requirement and scenario ids it reserved are visible to every other clone from that moment; and SHALL commit nothing when it did not create the branch.

#### Scenario: SCN-165a — A colleague sees the reservation at once

- GIVEN two clones of one repository, and a colleague who has just opened PET-104 with `specgate propose --from-ticket PET-104.json --capability owners`
- WHEN the developer, in the other clone, runs `git fetch` and looks at the colleague's branch
- THEN that branch holds PET-104's change, with its `req_range`, in a commit "PET-104 docs(spec): open the change from the ticket"

<!-- specgate:trace status=Implemented test=tests/unit/change-overlap.test.ts actor=Developer kind=functional -->
