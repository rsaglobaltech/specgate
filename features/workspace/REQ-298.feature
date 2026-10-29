Feature: The workspace as a model other views read

  @REQ-298 @SCN-298a
  Scenario: The model other views read
    Given a workspace with the repository fleet
    When the developer runs `specgate workspace status --json`, and then in a folder with no workspace file
    Then the model has exactly those keys, and without the file `workspace` is null with workspace_missing
