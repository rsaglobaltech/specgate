Feature: The run record keeps each check's outcome

  @REQ-228 @SCN-228a
  Scenario: The record of a passing requirement
    Given a requirement that passes with the checks `marker` and `final`
    When its run record is read
    Then its result lists both, in order, with their stage and verdict, and no output
