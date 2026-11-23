# Delta — project-setup

## ADDED Requirements

### Requirement: REQ-489 — adopt --dry-run lists what adopt --yes writes

The system SHALL list in `specgate adopt --dry-run` every file `specgate adopt --yes` would write in the same folder, and no other: README.md and .gitattributes when it would write them, harness.config.yaml when it would save a detected command, the agents' files it would install, and the CI gate only when it would write it.

#### Scenario: SCN-489a — A Node project with no README.md

- GIVEN two copies of a Node project with a `test` script, no README.md and no .gitattributes
- WHEN `specgate adopt --dry-run` runs on one and `specgate adopt --yes` on the other
- THEN the files the dry run lists are exactly the files the other run wrote, README.md and .gitattributes among them, and the first copy is unchanged

<!-- specgate:trace status=Implemented actor=Developer kind=functional -->
