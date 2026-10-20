# Delta — trusted-gate

## ADDED Requirements

### Requirement: REQ-152 — New ids are free on every branch, not only this one

The system SHALL, when it reserves requirement ids for a new change (`propose`, `propose --from-brief`, `propose --from-ticket`, `new`, `req`) or numbers the first scenario of a draft, start above every `REQ-` and `SCN-` number used by a change on any local branch or remote-tracking branch of the repository, as well as above those of the working tree, so that two changes opened on two branches never mint the same id; and SHALL work as before outside a git repository.

#### Scenario: SCN-152a — Two tickets, two branches

- GIVEN a repository whose branch `feature/KAN-14-vehicle-type-catalog` holds a change reserving REQ-002 to REQ-005 with scenarios SCN-002 to SCN-006, and the developer is on `develop`, which has none of them
- WHEN the developer runs `specgate propose --from-ticket KAN-13.json --capability parking`
- THEN the change `kan-13-register-vehicle-entry` reserves ids from REQ-006 up, and its `DRAFTING.md` starts scenarios at SCN-007

<!-- specgate:trace status=Implemented test=tests/unit/ticket-source.test.ts actor=Developer kind=functional -->
