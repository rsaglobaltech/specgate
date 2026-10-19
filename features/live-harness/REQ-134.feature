Feature: A guided tour of the loop that leaves the repository untouched

  @REQ-134 @SCN-134a
  Scenario: The tour on a Node repository
    Given an adopted Node repository
    When the developer runs `specgate onboard --tour`
    Then the output shows the four verbs and `check` in order, each passing, and ends naming `specgate propose`
    And the repository's files are unchanged
