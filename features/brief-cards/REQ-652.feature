Feature: Two modules drafted at once leave each other's draft alone

  @REQ-652 @SCN-652a
  Scenario: draft-b's agent writes while draft-a's runs
    Given a project where draft-b's agent runs, and draft-a's agent writes its own draft, writes on in draft-b's folder and touches draft-c, which no agent drafts
    When draft-a's agent ends
    Then draft-a's draft is what it wrote, draft-b's files are as last written, draft-c's file is undone, and draft-a's mark says when its agent ran without showing in git's status
