Feature: Approvals recorded by the first candidates keep counting

  @REQ-371 @SCN-371a
  Scenario: A record written by 1.0.0-rc.2
    Given an approval of tasks.md recorded with the hash of its text as written, a task already ticked
    When its approvals are read
    Then the tasks are approved
