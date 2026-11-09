Feature: An old specs.yml replaced only after showing the difference

  @REQ-461 @SCN-461a
  Scenario: Without --replace
    Given a project with the old `.github/workflows/specs.yml`
    When `specgate ci init --provider github` runs
    Then it lists what the gate would add, writes no file, and says `specgate ci init --provider github --replace`
