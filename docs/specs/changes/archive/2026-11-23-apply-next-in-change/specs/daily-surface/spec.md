# Delta — daily-surface

## ADDED Requirements

### Requirement: REQ-465 — After apply, Next stays in the change

The system SHALL, after `specgate apply` delivers a requirement of an open change, name as the next step the next requirement of that same change that is still to do and not waiting for an answer; only when that change has none SHALL it name the project's next requirement, and when every requirement of the change is delivered it SHALL name `specgate archive` for it, as before.

#### Scenario: SCN-465a — The change's last requirement before the project's

- GIVEN the open change `draft-specgate-port` with REQ-014 still to do, and the project's REQ-000 still to do outside any change
- WHEN `specgate apply REQ-016` delivers a requirement of `draft-specgate-port`
- THEN the next step it prints is `specgate apply REQ-014`, not `specgate apply REQ-000`

#### Scenario: SCN-465b — The rest of the change waits for an answer

- GIVEN the open change `draft-specgate-port` whose only requirement left, REQ-014, waits for the answer to Q2, and the project's REQ-000 still to do
- WHEN `specgate apply REQ-016` delivers a requirement of `draft-specgate-port`
- THEN the next step it prints is `specgate apply REQ-000`

<!-- specgate:trace status=Implemented actor=Developer kind=functional -->
