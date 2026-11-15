Feature: Principles delivered by a pack

  @REQ-332 @SCN-332a
  Scenario: The organization released its principles pack 2.0.0
    Given principles.md says `principles_version: 1.0.0` and `source: pack:principles`, `.specops.lock` records the pack principles from a local folder whose pack.yaml now says version 2.0.0
    When the developer runs `specgate check --json`
    Then a warning `principles_behind` names 1.0.0, 2.0.0 and `specgate specops sync`
