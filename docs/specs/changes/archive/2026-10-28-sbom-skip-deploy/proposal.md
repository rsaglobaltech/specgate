# Proposal: sbom-skip-deploy

## Intent

forja's Quarkus pom skips the deploy phase, and the CycloneDX Maven plugin then writes no bill of
materials ("Skipping CycloneDX goal, because module skips deploy"): the `sbom` check had nothing for
the dependency scan to read (truck-flote run 6, S59).

## Scope

- The `sbom` check runs CycloneDX with `-Dcyclonedx.skipNotDeployed=false`.
