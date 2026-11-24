# Delta — harness

## ADDED Requirements

### Requirement: REQ-692 — The agent reads the principles

<!-- specgate:trace status=Implemented feature=features/harness/REQ-692.feature actor=Developer kind=functional -->

The system SHALL, when `docs/specs/principles.md` exists, put each principle's id, title and statement into the harness prompt under a "Principles" heading, so that the agent knows them before it writes code.

> Found on 2026-11-23: P1 was checked only by `specgate check`; the agent complied by imitating existing code.

#### Scenario: SCN-692a — P1 in the prompt

- GIVEN principles.md with `## P1 — Code names its requirement`
- WHEN the Developer runs `specgate harness run --req REQ-004 --dry-run`
- THEN the prompt has a "Principles" section naming P1 and its statement

### Requirement: REQ-693 — The harness gate runs the principles

<!-- specgate:trace status=Implemented feature=features/harness/REQ-693.feature actor=Developer kind=functional -->

The system SHALL, in the harness gate after the test command, run each principle that declares `run=` in the worktree as the stage `principles`, failing the attempt on an error-level principle that exits non-zero — naming its id and command, which the next attempt is told — and reporting a warn-level one without failing.

#### Scenario: SCN-693a — Code without its requirement's id

- GIVEN P1 `run="! grep -L 'REQ-[0-9]' src/*.js | grep ."` and an agent that writes `src/x.js` without a requirement id
- WHEN the harness gates the attempt
- THEN the attempt fails at the stage `principles` naming P1

### Requirement: REQ-695 — A dry run shows the trust skip

<!-- specgate:trace status=Implemented feature=features/harness/REQ-695.feature actor=Developer kind=functional -->

The system SHALL, on `specgate harness run --dry-run`, print for each requirement the trust level would refuse `skipped (trust_level)` and the reason, instead of its prompt.

#### Scenario: SCN-695a — ausleihe at level 2, without --req

- GIVEN `trust: { ausleihe: 2 }` and REQ-006 of ausleihe pending
- WHEN the Developer runs `specgate harness run --dry-run`
- THEN REQ-006 shows `skipped (trust_level)` with "needs 3", and no prompt for it
