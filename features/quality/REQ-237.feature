Feature: Maven dependencies are scanned from the build's own bill of materials

  @REQ-237 @SCN-237a
  Scenario: A Spring Boot parent manages the versions
    Given a Maven project whose dependencies take their versions from `spring-boot-starter-parent`
    When `specgate quality init` writes its checks
    Then an `sbom` check runs the CycloneDX Maven plugin to `target/bom.json` before `dependencies`, which runs osv-scanner on `target/bom.json`
