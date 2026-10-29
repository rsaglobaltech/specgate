Feature: What to strengthen

  @REQ-303 @SCN-303a
  Scenario: The check that catches most
    Given three requirements suggested as spec → implementation, two caught by `pmd` and one by `test command`
    When the report is read
    Then it says to strengthen `pmd`
