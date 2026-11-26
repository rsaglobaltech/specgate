Feature: The gate runs the sealed tests with the project's command

  @REQ-759 @SCN-759a
  Scenario: Red is red
    Given sealed tests and `acceptance_cmd` set to a command that exits 1
    When `specgate check` runs
    Then the gate fails with `acceptance_red` and the command's output

  @REQ-759 @SCN-759b
  Scenario: No command
    Given sealed tests and no `acceptance_cmd`
    When `specgate check` runs
    Then the gate fails with `acceptance_no_command`, and the project's files and dependencies are as they were
