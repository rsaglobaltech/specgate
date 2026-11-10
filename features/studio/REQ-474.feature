Feature: The studio opens a folder that is not a project yet

  @REQ-474 @SCN-474a
  Scenario: An existing project adopted from the studio
    Given a local Node project with no specgate files
    When the developer runs `specgate studio` there, previews the adoption and confirms it
    Then the studio shows the files the preview listed, then the adopted project's Home with its one requirement, and the folder has spec.md and `test_cmd: npm test`
