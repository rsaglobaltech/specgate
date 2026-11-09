# Delta — quality

## ADDED Requirements

### Requirement: REQ-254 — Docker counts only when it runs Linux containers

The system SHALL treat Docker as available for the quality checks only when its server runs Linux containers, and SHALL, when it runs Windows containers, skip a Docker check saying to switch Docker Desktop to Linux containers, instead of pulling an image that has no manifest for Windows.

#### Scenario: SCN-254a — Docker Desktop on Windows containers

- GIVEN a Docker server that reports `windows` as its operating system
- WHEN a check that runs in Docker is resolved
- THEN it is skipped, saying to switch Docker Desktop to Linux containers, and no image is pulled

<!-- specgate:trace status=Implemented test=tests/unit/quality-checks.test.ts actor=Developer kind=functional -->
