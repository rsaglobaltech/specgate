Feature: A delivery on a test alone says so

  @REQ-735 @SCN-735a
  Scenario: Delivered, and said plainly
    Given a project without `bdd: required` and REQ-004 with a passing test that names it
    When the Developer runs `specgate apply REQ-004`
    Then REQ-004 is Implemented and the output says its scenarios were not run, naming `specgate migrate bdd`

  @REQ-735 @SCN-735b
  Scenario: Status counts the requirements delivered on a test alone
    Given that project with three requirements delivered
    When the Developer runs `specgate status --json`
    Then the answer says 3 requirements were delivered without their scenarios run
