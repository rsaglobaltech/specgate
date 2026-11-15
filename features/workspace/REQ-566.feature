Feature: The workspace's Live is the studio's

  @REQ-566 @SCN-566a
  Scenario: The workspace's Live in the studio
    Given a workspace where tracking builds REQ-005 at its second attempt and fleet's folder is missing, and a story whose fleet part waits on tracking:REQ-005
    When a lead opens the studio's Live in the workspace repository
    Then tracking shows REQ-005, its attempt, phase and cost, with a link to /live/repo/tracking/; fleet says its folder is missing; the story's fleet part says it waits on tracking:REQ-005
