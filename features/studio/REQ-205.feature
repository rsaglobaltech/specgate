Feature: Home says what to do next

  @REQ-205 @SCN-205a
  Scenario: Questions come first
    Given two open questions, an unapproved draft and requirements ready to build
    When Home is read
    Then its next action is to answer the questions, naming how many

  @REQ-205 @SCN-205b
  Scenario: Then review, then build, then done
    Given no open question and an unapproved draft, then no draft, then nothing left to build
    When Home is read each time
    Then the next action is review the draft, then build, then nothing left
