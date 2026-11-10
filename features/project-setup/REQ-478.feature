Feature: The adoption baseline names no path that is not one

  @REQ-478 @SCN-478a
  Scenario: plan right after adoption
    Given a Node project just adopted
    When the developer runs `specgate plan --format json`
    Then no finding names `npm test` or `existing codebase` as a missing file for REQ-001
