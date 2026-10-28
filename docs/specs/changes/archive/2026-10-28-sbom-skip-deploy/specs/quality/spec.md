# Delta — quality

## ADDED Requirements

### Requirement: REQ-276 — The bill of materials of a module that is not deployed

The system SHALL write the `sbom` check of a Maven project so that CycloneDX writes the bill of materials of a module whose pom skips the deploy phase — `-Dcyclonedx.skipNotDeployed=false` — since an application is scanned whether it is published or not.

#### Scenario: SCN-276a — A Quarkus application

- GIVEN a Maven project whose pom sets `maven.deploy.skip`
- WHEN `specgate quality init` writes the checks
- THEN the `sbom` check's command carries `-Dcyclonedx.skipNotDeployed=false`

<!-- specgate:trace status=Implemented test=tests/unit/quality-presets.test.ts actor=Developer kind=functional -->
