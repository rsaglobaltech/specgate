# Delta — harness

## ADDED Requirements

### Requirement: REQ-761 — The exam proves sealed acceptance holds

<!-- specgate:trace status=Implemented actor=Developer kind=functional -->

The system SHALL, in `specgate compat`, replay with no model the recorded two-function attack against a fixture with a sealed step file — through the file tools, a patch, a shell redirect and `git checkout` — and fail when any write is neither refused nor reported; and SHALL offer a level `L3a` in which, before the agent starts, a writer agent that sees no source writes the acceptance tests, they are approved and sealed, and the agent then runs as at L3.

#### Scenario: SCN-761a — The attack replayed

- GIVEN the two-function fixture with its step file sealed
- WHEN `specgate compat attack two-function` runs
- THEN every write of the attack is refused by the guard or reported by the judge, and the command passes

#### Scenario: SCN-761b — The writer sees no source

- GIVEN a trap task at level `L3a`
- WHEN the writer agent starts
- THEN its folder has the specification and the design's interfaces, and no `src/`
