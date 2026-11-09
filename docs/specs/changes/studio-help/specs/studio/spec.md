# Delta — studio-help

## ADDED Requirements

### Requirement: REQ-452 — A "?" that says what a feature does in the background

The system SHALL show beside every studio feature that writes, runs, commits, pushes or sends a "?" button that, when pressed, opens an explanation of what it does, the command it runs, the files it changes, what it does not do and what comes next, in the studio's language; and SHALL make it reachable and closable with the keyboard, its state announced to screen readers.

#### Scenario: SCN-452a — What Ask for a change does

- GIVEN a draft to review in Changes
- WHEN the "?" beside Ask for a change is pressed with the keyboard
- THEN an explanation opens saying the request is added to the change's review.md and the draft changes only when it is drafted again, the "?" says it is expanded, and Escape closes it and returns the focus to the "?"

<!-- specgate:trace status=Draft actor=Developer kind=functional -->

### Requirement: REQ-453 — A notice that says what happened

The system SHALL, when a studio action ends, say in its notice what it wrote or ran and the next step, and SHALL never say only that it is done.

#### Scenario: SCN-453a — A preference saved

- GIVEN Settings open
- WHEN the test command is saved as `npm test`
- THEN the notice says `specgate config set test_cmd` wrote it to harness.config.yaml and that the gate now runs it

<!-- specgate:trace status=Draft actor=Developer kind=functional -->

### Requirement: REQ-454 — No feature without its explanation

The system SHALL hold, for every action the studio runs and every write it accepts, an explanation in Spanish and English; and the project's tests SHALL fail when an action or a write has none.

#### Scenario: SCN-454a — An action added without its explanation

- GIVEN a new action in the studio's list with no explanation
- WHEN the project's tests run
- THEN they fail, naming the action and the language that lacks it

<!-- specgate:trace status=Draft actor=Developer kind=functional -->
