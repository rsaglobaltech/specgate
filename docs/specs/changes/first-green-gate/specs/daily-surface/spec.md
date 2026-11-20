# Delta — daily-surface

## ADDED Requirements

### Requirement: REQ-612 — The baseline of adopted code is not work to do

The system SHALL, in the text of `status`, show the pending baseline requirement of a project adopted with code apart from the "To do" list, saying the test suite holds it on every check and that a test naming it that starts the product closes it, and leave it out of the count of requirements; SHALL keep `status --json` as it was; and SHALL list the first requirement of a project adopted with no code under "To do" as any other.

#### Scenario: SCN-612a — After adoption

- GIVEN a project with code, just adopted
- WHEN the developer runs `specgate status` and `specgate status --json`
- THEN the text says `0 of 0 done` and `REQ-001 Preserve existing behaviour: your test suite holds it on every check`, says `To close it, name REQ-001 in a test that starts the product`, has no "To do" list, and the JSON counts 1 requirement

#### Scenario: SCN-612b — No code

- GIVEN an empty folder, just adopted
- WHEN the developer runs `specgate status`
- THEN it says `0 of 1 done` and lists REQ-001 under "To do"

<!-- specgate:trace actor=Developer feature=features/daily-surface/REQ-612.feature kind=functional status=Approved -->
