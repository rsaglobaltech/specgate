Feature: Status counts requirements, not scenarios

  @REQ-615 @SCN-615a
  Scenario: One requirement, two scenarios, nothing built
    Given an adopted project with one new requirement that has two scenarios
    When the developer runs `specgate status`
    Then it says `0 of 1 done` and names the requirement once under `To do`

  @REQ-615 @SCN-615b
  Scenario: Half of a requirement
    Given a requirement with one scenario done and one not, and another with both done
    When its progress is counted
    Then one of two requirements is done

  @REQ-615 @SCN-615c
  Scenario: What programs read
    Given the project of the first scenario
    When the developer runs `specgate status --json`
    Then `requirements` holds one entry for each scenario of the requirement
