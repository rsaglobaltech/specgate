# Delta — trusted-gate

## ADDED Requirements

### Requirement: REQ-556 — npm publishes through trusted publishing

The system SHALL run the npm publish job with `id-token: write` and npm 11.5.1 or later, so that npm authenticates the publish through trusted publishing (OIDC) when the package's trusted publisher names this repository and `publish-npm.yml`; the job SHALL NOT pass a token to any step other than the publish steps and the version check; and `docs/release-process.md` SHALL describe configuring the trusted publisher and removing the token after the first trusted publish.

#### Scenario: SCN-556a — The publish job is ready for OIDC

- GIVEN the repository's `publish-npm.yml`
- WHEN a maintainer reads its publish job
- THEN it grants `id-token: write`, installs npm 11.5.1 or later before publishing, and passes `NPM_TOKEN` only to the version check and the publish steps

<!-- specgate:trace status=Implemented feature=features/trusted-gate/REQ-556.feature actor=Maintainer kind=functional -->
