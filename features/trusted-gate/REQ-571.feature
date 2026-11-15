Feature: A version is checked against the surface before it is published

  @REQ-571 @SCN-571a
  Scenario: The publish job checks the version
    Given the publish workflow
    When it runs for a tag
    Then it runs `contract:check --release` with the version, after the test suite and before publishing
