# Delta — trusted-gate

## ADDED Requirements

### Requirement: REQ-281 — A release candidate is never what people install by default

The system SHALL publish a version whose number has a prerelease part (`1.0.0-rc.1`), when its tag is pushed, under the npm and GitHub Packages dist-tag `next` and as a Docker image tagged with its version only, never `latest`; a final version (`0.27.9`) SHALL stay `latest` on all three.

#### Scenario: SCN-281a — The first 1.0 release candidate

- GIVEN the tag `v1.0.0-rc.1` is pushed with `package.json` at `1.0.0-rc.1`
- WHEN the npm, GitHub Packages and Docker publish workflows run
- THEN npm and GitHub Packages publish it under `next`, the image is tagged `1.0.0-rc.1` and not `latest`, and the image's smoke test runs `1.0.0-rc.1`

#### Scenario: SCN-281b — A final version

- GIVEN the tag `v0.27.9` is pushed with `package.json` at `0.27.9`
- WHEN the same workflows run
- THEN npm and GitHub Packages publish it under `latest`, and the image is tagged `0.27.9`, `0.27` and `latest`

<!-- specgate:trace status=Implemented test=tests/unit/release-workflows.test.ts actor=Developer kind=functional -->
