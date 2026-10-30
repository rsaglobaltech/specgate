# Delta — harness

## ADDED Requirements

### Requirement: REQ-417 — An empty attempt after a written one is retried once

The system SHALL attempt a requirement once more, with attempts left, when its agent produced no files and an attempt earlier in the same run did, telling the agent it wrote nothing; and SHALL stop as before when no attempt of the run wrote, or after that one retry.

#### Scenario: SCN-417a — The agent writes nothing for one requirement of the run

- GIVEN a project with REQ-000, REQ-001 and REQ-002, and an agent that writes the first time for each, except the first time for REQ-001
- WHEN the developer runs `specgate harness run --max-attempts 2`
- THEN REQ-001 says the agent produced no files and is retried once, and all three pass

<!-- specgate:trace actor=Developer kind=functional status=Implemented feature=features/harness/REQ-417.feature test=tests/unit/harness-run.test.ts -->
