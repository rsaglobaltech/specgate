# Delta — daily-surface

## ADDED Requirements

### Requirement: REQ-615 — Status counts requirements, not scenarios

The system SHALL, in the text of `status`, count each requirement once in the progress line whatever its number of scenarios, count it as done only when every scenario of it is, and name it once in each list; and SHALL keep one entry per scenario in `status --json`.

#### Scenario: SCN-615a — One requirement, two scenarios, nothing built

- GIVEN an adopted project with one new requirement that has two scenarios
- WHEN the developer runs `specgate status`
- THEN it says `0 of 1 done` and names the requirement once under `To do`

#### Scenario: SCN-615b — Half of a requirement

- GIVEN a requirement with one scenario done and one not, and another with both done
- WHEN its progress is counted
- THEN one of two requirements is done

#### Scenario: SCN-615c — What programs read

- GIVEN the project of the first scenario
- WHEN the developer runs `specgate status --json`
- THEN `requirements` holds one entry for each scenario of the requirement

<!-- specgate:trace actor=Developer feature=features/daily-surface/REQ-615.feature kind=functional status=Approved -->
