Feature: A folder that is not a project is refused

  @REQ-469 @SCN-469a
  Scenario: An empty folder
    Given an empty folder
    When a program calls `status(dir)` on it
    Then the call rejects with code `not_a_project`, the folder in its message, and the fix `specgate init`
