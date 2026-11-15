Feature: Jira and Azure Boards from the studio

  @REQ-444 @SCN-444a
  Scenario: A sync previewed, then run
    Given `alm.config.yaml` naming `JIRA_TOKEN`, and REQ-007 not linked to an issue
    When the sync is previewed
    Then the preview says an issue would be created for REQ-007, nothing is written, and no field asks for a token
