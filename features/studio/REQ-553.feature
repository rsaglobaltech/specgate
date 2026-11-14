Feature: The studio serves a team, by role

  @REQ-553 @SCN-553a
  Scenario: A reader tries to answer a question
    Given `studio --team` running with `studio.team.yaml` giving `ana` the role `reader`
    When `ana` signs in and answers an open question through the studio's API
    Then the answer is refused with `role_forbidden` and `questions.md` is unchanged
