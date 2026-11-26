# Delta — trusted-gate

## ADDED Requirements

### Requirement: REQ-733 — The harness gate runs the requirement's scenarios

<!-- specgate:trace status=Implemented feature=features/trusted-gate/REQ-733.feature actor=Developer kind=functional -->

The system SHALL, on `specgate harness run` in a project with `bdd: required`, run the requirement's scenarios through `bdd_cmd` as the gate's stage `scenarios`, after the test command; fail the attempt when they do not end well, telling the next attempt which scenarios failed and what they printed; and mark no requirement delivered whose scenarios failed.

> Found on 2026-11-24: the harness marked a requirement delivered without running its scenarios — it skips apply's gate, having run its own, and the scenarios were in neither.

#### Scenario: SCN-733a — Built to a test that says something else

- GIVEN a project with `bdd: required`, REQ-004 pending, and an agent whose code passes the test command and fails REQ-004's scenarios
- WHEN the Developer runs `specgate harness run --req REQ-004 --max-attempts 1`
- THEN REQ-004 fails at the stage `scenarios`, is not Implemented, and the report names the scenario that failed

#### Scenario: SCN-733b — Its scenarios pass

- GIVEN the same project and an agent whose code passes the test command and REQ-004's scenarios
- WHEN the Developer runs `specgate harness run --req REQ-004`
- THEN the gate's stages include `scenarios`, passed, and REQ-004 is Implemented

#### Scenario: SCN-733c — Not required, not run

- GIVEN a project whose gate.yaml does not say `bdd: required`
- WHEN the Developer runs `specgate harness run --req REQ-004`
- THEN the gate has no stage `scenarios`

### Requirement: REQ-734 — Check runs the delivered requirements' scenarios

<!-- specgate:trace status=Implemented feature=features/trusted-gate/REQ-734.feature actor=Developer kind=functional -->

The system SHALL, on `specgate check` in a project with `bdd: required` and a `bdd_cmd`, run as the stage `scenarios` the scenarios of each delivered requirement that has a feature file, one requirement after the other, and fail naming each requirement and scenario that did not end well; with `--no-scenarios` it SHALL leave the stage out and report it as skipped at the Developer's word.

> What CI runs is `specgate check`: code changed after its requirement was delivered, to say something else than its scenario, passed there.

#### Scenario: SCN-734a — Code changed after delivery

- GIVEN a project with `bdd: required`, REQ-004 Implemented, and code changed so REQ-004's scenario SCN-004a fails while the test command passes
- WHEN the Developer runs `specgate check`
- THEN the gate fails at the stage `scenarios` with `check_scenarios_failed` naming REQ-004 and SCN-004a

#### Scenario: SCN-734b — Left out at the Developer's word

- GIVEN the same project
- WHEN the Developer runs `specgate check --no-scenarios`
- THEN the stage `scenarios` is reported skipped, naming the flag, and the other stages decide

### Requirement: REQ-735 — A delivery on a test alone says so

<!-- specgate:trace status=Implemented feature=features/trusted-gate/REQ-735.feature actor=Developer kind=functional -->

The system SHALL, in a project whose gate does not require executable scenarios, say on `specgate apply <REQ>` that the requirement was delivered on a test that names it and that its scenarios were not run, with `specgate migrate bdd` as the way; and show on `specgate status` how many delivered requirements stand so.

> One warning for the whole project let every requirement look checked against its scenarios.

#### Scenario: SCN-735a — Delivered, and said plainly

- GIVEN a project without `bdd: required` and REQ-004 with a passing test that names it
- WHEN the Developer runs `specgate apply REQ-004`
- THEN REQ-004 is Implemented and the output says its scenarios were not run, naming `specgate migrate bdd`

#### Scenario: SCN-735b — Status counts the requirements delivered on a test alone

- GIVEN that project with three requirements delivered
- WHEN the Developer runs `specgate status --json`
- THEN the answer says 3 requirements were delivered without their scenarios run
