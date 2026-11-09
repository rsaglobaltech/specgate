Feature: The bill of materials of a module that is not deployed

  @REQ-276 @SCN-276a
  Scenario: A Quarkus application
    Given a Maven project whose pom sets `maven.deploy.skip`
    When `specgate quality init` writes the checks
    Then the `sbom` check's command carries `-Dcyclonedx.skipNotDeployed=false`
