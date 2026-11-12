Feature: apply runs the tests of the requirement it delivers

  @REQ-515 @SCN-515a
  Scenario: apply with {files}
    Given the project of SCN-510a with REQ-001 Approved and `test_cmd_affected` `node run-tests.js {files}`
    When a person runs `specgate apply REQ-001`
    Then REQ-001 is Implemented and the tests that ran were REQ-001's test file alone
