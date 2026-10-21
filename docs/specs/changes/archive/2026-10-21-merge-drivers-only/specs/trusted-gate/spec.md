# Delta — trusted-gate

## ADDED Requirements

### Requirement: REQ-172 — A clone registers the merge drivers alone

The system SHALL, on `specgate harness init --merge-drivers`, register the merge drivers in the clone's git config, adding their rules to `.gitattributes` only when they are missing, and write no other file; and the messages that tell a clone to register the drivers SHALL name `specgate harness init --merge-drivers`.

#### Scenario: SCN-172a — A developer's fresh clone

- GIVEN a clone whose committed `.gitattributes` routes the capability specs and the matrix to the drivers, with a committed `harness.config.yaml`, and no driver in its git config
- WHEN the developer runs `specgate harness init --merge-drivers`
- THEN `merge.specgate-spec.driver` and `merge.specgate-matrix.driver` are set in its git config, and `git status --porcelain` is empty

<!-- specgate:trace status=Implemented test=tests/cli.test.ts actor=Developer kind=functional -->
