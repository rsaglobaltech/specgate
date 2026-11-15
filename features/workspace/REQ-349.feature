Feature: What a story's build writes is not committed

  @REQ-349 @SCN-349a
  Scenario: After init
    Given a new workspace
    When the developer runs `specgate workspace init`
    Then `.gitignore` lists `.specgate/workspace-runs/`
