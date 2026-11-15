# Delta — daily-surface

## ADDED Requirements

### Requirement: REQ-555 — sgate is a short alias of specgate

The system SHALL install the command `sgate` next to `specgate`, running the same entry point with the same arguments and output, and `specgate completion bash|zsh|fish` SHALL complete `sgate` as it completes `specgate`.

#### Scenario: SCN-555a — The short alias

- GIVEN the package installed
- WHEN a developer runs `sgate --version` and `specgate --version`
- THEN both print the same version, and the completion script for each shell registers `sgate`

<!-- specgate:trace status=Implemented feature=features/daily-surface/REQ-555.feature actor=Developer kind=functional -->
