# Delta — ticket-source

## ADDED Requirements

### Requirement: REQ-159 — The pull request carries the archived change

The system SHALL, on `specgate alm pr <change>`, find the change under `docs/specs/changes/archive/` — the most recent `<date>-<change>` — when it is no longer open, so the ticket's pull request can carry its archive; and SHALL, when `specgate archive` archives a change opened from a ticket, name `specgate alm pr <change>` as the next step instead of the brief's next module.

#### Scenario: SCN-159a — Archived before its pull request

- GIVEN the branch `feature/KAN-13-register-vehicle-entry` whose change `kan-13-register-vehicle-entry` is archived as `2026-10-20-kan-13-register-vehicle-entry`, and a GitHub with no open pull request for it
- WHEN the developer runs `specgate alm pr kan-13-register-vehicle-entry`
- THEN one pull request is created titled "KAN-13 Register vehicle entry", whose body lists the change's requirements

<!-- specgate:trace status=Implemented test=tests/unit/ticket-source.test.ts actor=Developer kind=functional -->
