Feature: A release candidate is never what people install by default

  @REQ-281 @SCN-281a
  Scenario: The first 1.0 release candidate
    Given the tag `v1.0.0-rc.1` is pushed with `package.json` at `1.0.0-rc.1`
    When the npm, GitHub Packages and Docker publish workflows run
    Then npm and GitHub Packages publish it under `next`, the image is tagged `1.0.0-rc.1` and not `latest`, and the image's smoke test runs `1.0.0-rc.1`

  @REQ-281 @SCN-281b
  Scenario: A final version
    Given the tag `v0.27.9` is pushed with `package.json` at `0.27.9`
    When the same workflows run
    Then npm and GitHub Packages publish it under `latest`, and the image is tagged `0.27.9`, `0.27` and `latest`
