# Delta — ticket-source

## ADDED Requirements

### Requirement: REQ-171 — The check says where the change will go

The system SHALL, on `specgate propose --from-ticket <ticket> --check` in a Specgate project, report the capability the change would be opened in, from `--capability` or the mapping of the ticket's epic, as `capability` in its JSON output, `null` when there is none; and SHALL then warn `ticket_no_capability`, naming the capabilities under `docs/specs/capabilities/`, without making the ticket not ready.

#### Scenario: SCN-171a — A story without an epic

- GIVEN a Specgate project with the capability `billing`, and the story PAY-123, ready, with no epic
- WHEN the developer runs `specgate propose --from-ticket PAY-123.json --check --json`
- THEN it reports `ready` true and `capability` null, and warns `ticket_no_capability` naming `billing`; with `--capability billing` it reports `capability` "billing" and no such warning

<!-- specgate:trace status=Implemented test=tests/unit/ticket-source.test.ts actor=Developer kind=functional -->
