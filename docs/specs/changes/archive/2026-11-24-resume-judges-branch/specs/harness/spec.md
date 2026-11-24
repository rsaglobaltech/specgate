# Delta — harness

## ADDED Requirements

### Requirement: REQ-708 — A continued branch that holds the work is judged by the gate

<!-- specgate:trace status=Implemented feature=features/harness/REQ-708.feature actor=Developer kind=functional -->

The system SHALL, when a resumed attempt's agent changes no file and the requirement's branch already holds files changed since its base other than the prompt archive, run the gate on the branch as it stands instead of stopping the attempt as "no-op"; a run that is not resumed, or a branch that holds nothing beyond its base, still stops as "no-op".

> Found on 2026-11-24 in pintamundo-ai: "Continue" on REQ-002, whose branch held its test and code, failed in 22 s as "no-op".

#### Scenario: SCN-708a — The branch holds the work

- GIVEN REQ-004's branch left by an earlier run with its test and code, and an agent that writes nothing
- WHEN the Developer runs `specgate harness run --req REQ-004 --resume`
- THEN the gate runs on the branch, and REQ-004 passes on harness/REQ-004

#### Scenario: SCN-708b — Nothing on the branch

- GIVEN REQ-004's branch holding only the prompt archive of an earlier attempt, and an agent that writes nothing
- WHEN the Developer runs `specgate harness run --req REQ-004 --resume`
- THEN REQ-004 fails at the stage "no-op" and the gate does not run
