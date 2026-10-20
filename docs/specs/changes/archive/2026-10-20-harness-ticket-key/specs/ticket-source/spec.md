# Delta — ticket-source

## ADDED Requirements

### Requirement: REQ-156 — The harness's commits name the ticket

The system SHALL, when `specgate harness run` commits a requirement that an open change opened from a ticket adds or modifies, start the commit message with the ticket key (`KAN-14 REQ-002: …`), and SHALL start the merge commit of `--chain` with it too, so the Git host shows the harness's work in the ticket and `check` does not warn `ticket_key_missing` about it; a requirement of no such change keeps the message it had.

#### Scenario: SCN-156a — A requirement of KAN-14

- GIVEN an open change `kan-14-vehicle-type-catalog` with `ticket: KAN-14` whose delta adds REQ-002
- WHEN the harness commits REQ-002 on its third attempt of three
- THEN the commit message starts "KAN-14 REQ-002: implement via specgate harness"

<!-- specgate:trace status=Implemented test=tests/unit/ticket-source.test.ts actor=Developer kind=functional -->
