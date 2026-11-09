Feature: The ticket's branch, known before the change is opened

  @REQ-447 @SCN-447a
  Scenario: On the branch agentkit made
    Given a project on the branch `feature/parking/KAN-13`
    When Home is opened, and KAN-13 is then opened from Changes
    Then Home says the branch is KAN-13's, of the team parking, and the change is opened on `feature/parking/KAN-13` with `--no-branch`, no other branch created
