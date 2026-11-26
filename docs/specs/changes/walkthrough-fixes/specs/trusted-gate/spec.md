# Delta — trusted-gate

## ADDED Requirements

### Requirement: REQ-777 — Status names the approval a change waits for

<!-- specgate:trace actor=Developer kind=functional -->

The system SHALL, in `specgate status`, name `specgate change approve <id>` as the next command when the next requirement belongs to an open change nobody approved, with the reason that it waits for a person; and SHALL name the requirement's own next command once the change is approved.

#### Scenario: SCN-777a — A change nobody approved

- GIVEN export-csv open, its delta written, not approved
- WHEN the developer runs `specgate status`
- THEN the next command is `specgate change approve export-csv`, and once a person approved it, it is not

### Requirement: REQ-778 — A trace comment over several lines survives apply and archive

<!-- specgate:trace actor=Developer kind=functional -->

The system SHALL read a `specgate:trace` comment from its opening to its closing `-->` wherever it writes a field into it or gives a requirement a default feature file, so that a comment written over several lines keeps every field it holds through `apply` and `archive`.

#### Scenario: SCN-778a — The feature file it names stays its feature file

- GIVEN a requirement whose trace comment names `feature=features/pricing/dynamic_pricing.feature` on its second line
- WHEN it is applied and its change archived
- THEN its trace still names `features/pricing/dynamic_pricing.feature`, no other feature file is written for it, and `specgate check` passes

### Requirement: REQ-779 — A sealed test of an archived change is still checked and guarded

<!-- specgate:trace actor=Developer kind=functional -->

The system SHALL keep checking, in the gate's acceptance stage, and guarding, in the agent guards and the outside judge, an acceptance test sealed by a change that is now archived; a change that seals the same file later replaces its seal; and the fix for one that changed SHALL say to restore it or open a change that lists it and have a person approve it.

#### Scenario: SCN-779a — After the archive

- GIVEN export-csv's acceptance test sealed, and export-csv archived
- WHEN the test is changed and `specgate check` runs, or an agent's tool asks to write it
- THEN the gate fails with `acceptance_not_sealed`, and the write is refused with `acceptance_sealed`

### Requirement: REQ-780 — The verdict names the fix for what a person approved

<!-- specgate:trace actor=Developer kind=functional -->

The system SHALL end `specgate check` with `check_approved_changed`, and the fix that clears it, when what fails the open changes is only something a person approved — a sealed requirement, a sealed acceptance test, the design's scope; SHALL end a failing acceptance stage with `check_acceptance_failed`; and SHALL name, in the fix of `approve_needs_person`, the `--layer` the refused command asked for.

#### Scenario: SCN-780a — A sealed test changed

- GIVEN export-csv's acceptance test sealed and then changed
- WHEN the developer runs `specgate check`
- THEN it fails with `acceptance_not_sealed` and `check_approved_changed`, and not with `check_change_invalid`
