Feature: sgate is a short alias of specgate

  @REQ-555 @SCN-555a
  Scenario: The short alias
    Given the package installed
    When a developer runs `sgate --version` and `specgate --version`
    Then both print the same version, and the completion script for each shell registers `sgate`
