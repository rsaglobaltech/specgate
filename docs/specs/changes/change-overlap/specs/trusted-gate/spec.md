# Delta — trusted-gate

## ADDED Requirements

### Requirement: REQ-160 — Two changes that rewrite the same requirement are reported

The system SHALL, on `specgate check` and when it reports on a change opened from a ticket, warn with `change_overlap` for every requirement that an open change in the working tree modifies or removes and that another open change — on the same branch, or on any local or remote-tracking branch not yet merged into the current one — also modifies or removes, naming the other change and its branch and saying how to resolve it; and SHALL say nothing about a branch whose tip is already part of the current branch, nor about the same change seen on its own pushed branch.

#### Scenario: SCN-160a — Two tickets rewrite REQ-012

- GIVEN a repository whose branch `feature/KAN-16-exit` holds an open change `kan-16-exit` that modifies REQ-012, and the developer is on `feature/KAN-13-entry`, whose open change `kan-13-entry` also modifies REQ-012
- WHEN the developer runs `specgate check`
- THEN it warns `change_overlap` for REQ-012, naming `kan-16-exit` and `feature/KAN-16-exit`

#### Scenario: SCN-160b — The other branch is already merged

- GIVEN the same two changes, where `feature/KAN-16-exit` has since been merged into `feature/KAN-13-entry`
- WHEN the developer runs `specgate check`
- THEN it does not warn `change_overlap` for `kan-16-exit`

<!-- specgate:trace status=Implemented test=tests/unit/change-overlap.test.ts actor=Developer kind=functional -->
