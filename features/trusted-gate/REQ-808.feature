Feature: A matrix checked out with CRLF is current

  @REQ-808 @SCN-808a
  Scenario: CRLF, same rows
    Given a project whose generated matrix is current, rewritten with CRLF line endings
    When the Developer runs `specgate validate`
    Then no `matrix_stale` is reported

  @REQ-808 @SCN-808b
  Scenario: CRLF, a row changed
    Given the same matrix with CRLF line endings and one row's status changed
    When the Developer runs `specgate validate`
    Then `matrix_stale` is reported
