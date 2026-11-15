Feature: npm publishes through trusted publishing

  @REQ-556 @SCN-556a
  Scenario: The publish job is ready for OIDC
    Given the repository's `publish-npm.yml`
    When a maintainer reads its publish job
    Then it grants `id-token: write`, installs npm 11.5.1 or later before publishing, and passes `NPM_TOKEN` only to the version check and the publish steps
