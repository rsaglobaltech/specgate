Feature: The studio answers quickly and never fails in silence

  @REQ-430 @SCN-430a
  Scenario: A refresh that costs nothing
    Given the studio open on Home and no spec file changed
    When the view refreshes
    Then no process is started and the page is not redrawn

  @REQ-430 @SCN-430b
  Scenario: A failed read is said
    Given a `questions.md` the studio cannot read
    When Questions refreshes
    Then the page says it could not read it, why, and offers to retry
