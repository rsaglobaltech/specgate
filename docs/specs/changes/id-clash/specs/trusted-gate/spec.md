# Delta — trusted-gate

## ADDED Requirements

### Requirement: REQ-163 — A ticket's change sees the branches pushed meanwhile

The system SHALL, when `specgate propose --from-ticket <KEY>` opens a change in a repository with an `origin` remote, fetch `origin` before it reserves requirement and scenario ids, so the ids other developers' ticket branches already reserved are known; and SHALL go on, saying so, when the fetch fails.

#### Scenario: SCN-163a — A colleague pushed a ticket branch a minute ago

- GIVEN a clone whose `origin` has a branch `feature/PET-104-walk-in` this clone has never fetched, holding a change that reserves REQ-010
- WHEN the developer runs `specgate propose --from-ticket PET-103.json --capability owners`
- THEN PET-103's change reserves ids above REQ-010

<!-- specgate:trace status=Implemented test=tests/unit/change-overlap.test.ts actor=Developer kind=functional -->

### Requirement: REQ-164 — Two changes that add the same id are reported

The system SHALL, on `specgate check` and when it reports on a change opened from a ticket, warn with `change_id_clash` for every requirement id that an open change in the working tree adds and that another open change on any local or remote-tracking branch not merged into the current one also adds, naming the other change and its branch and saying to renumber the one not yet merged.

#### Scenario: SCN-164a — Both opened at the same second

- GIVEN a branch `feature/PET-104-walk-in` whose open change adds REQ-010, and the developer on `feature/PET-103-international`, whose open change adds REQ-010 too
- WHEN the developer runs `specgate check`
- THEN it warns `change_id_clash` for REQ-010, naming the PET-104 change and its branch

<!-- specgate:trace status=Implemented test=tests/unit/change-overlap.test.ts actor=Developer kind=functional -->
