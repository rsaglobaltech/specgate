# Delta — change-lifecycle

## ADDED Requirements

### Requirement: REQ-350 — change validate reports what approval refuses

The system SHALL, in `specgate change validate` of a layered change, report as errors the findings that `change approve` would refuse it for — the draft checklist's errors, such as a requirement with no kind, and its open questions — so validation never passes a change that approval then blocks.

#### Scenario: SCN-350a — A requirement with no kind

- GIVEN a layered change whose requirement has a trace with no `kind=`
- WHEN `specgate change validate` runs
- THEN it fails with `change_not_approvable` naming the missing kind, as `change approve` would

<!-- specgate:trace actor=Developer kind=functional status=Implemented test=tests/unit/rc2-change.test.ts -->

### Requirement: REQ-351 — The agent writing a change's requirements is told what they need

The system SHALL tell the agent that writes a layered change's requirements (`change author --artifact specs`, `change instructions specs`) to give each requirement's trace a `kind=` (functional, non-functional or business-rule) and an `actor=`, and a feature file of its own.

#### Scenario: SCN-351a — The instructions for the specs of a layered change

- GIVEN a layered change
- WHEN `specgate change instructions specs <id>` runs
- THEN its rules name `kind=`, `actor=` and one feature file per requirement

<!-- specgate:trace actor=Developer kind=functional status=Implemented test=tests/unit/rc2-change.test.ts -->

### Requirement: REQ-352 — Two requirements naming one feature file are reported

The system SHALL report, in `change validate` and when archiving, two requirements of a change whose traces name the same feature file, naming both and the file, since archiving lays one feature file per requirement and the second would replace the first's scenarios.

#### Scenario: SCN-352a — Three requirements, one feature file

- GIVEN a change whose REQ-002 and REQ-003 both trace `feature=features/x/follow.feature`
- WHEN `specgate change validate` runs
- THEN it fails with `change_feature_shared` naming REQ-002, REQ-003 and the file

<!-- specgate:trace actor=Developer kind=functional status=Implemented test=tests/unit/rc2-change.test.ts -->

### Requirement: REQ-353 — A delivered requirement ticks its tasks

The system SHALL, when a requirement of an open change is delivered (`specgate done`, which the harness runs), tick the unchecked tasks of that change's `tasks.md` that name the requirement, so archiving warns only about tasks no delivered requirement names.

#### Scenario: SCN-353a — The harness delivered REQ-002

- GIVEN an open change whose tasks.md has `- [ ] 2.1 Build the panel (REQ-002)` and `- [ ] 2.2 Docs`
- WHEN `specgate done REQ-002` delivers it
- THEN the task naming REQ-002 is ticked and the other is not

<!-- specgate:trace actor=Developer kind=functional status=Implemented test=tests/unit/rc2-change.test.ts -->

### Requirement: REQ-354 — The change command's help describes the three layers

The system SHALL describe, in `specgate change --help`, a new change as its three layers — discover, design and tasks — not as a proposal.

#### Scenario: SCN-354a — The help of change new

- GIVEN Specgate 1.0
- WHEN `specgate change --help` runs
- THEN the line for `new` names discover, design and tasks and not "proposal"

<!-- specgate:trace actor=Developer kind=functional status=Implemented test=tests/unit/rc2-change.test.ts -->
