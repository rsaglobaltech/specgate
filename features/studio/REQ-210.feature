Feature: Questions in the app

  @REQ-210 @SCN-210a
  Scenario: Open and to review
    Given Q6 is open with options listed and Q1 is answered with its assumption to review
    When Questions is read
    Then Q6 is listed with its options and form, and Q1 under the answers to confirm

  @REQ-210 @SCN-210b
  Scenario: An answer into a table without an Answer column
    Given `questions.md` with the columns `# | Question | Blocks | Options seen`, CRLF line endings, and Q1 open
    When Q1 is answered twice in the studio
    Then `questions.md` has `Answer` and `Status` columns, Q1's latest answer, CRLF endings, and Q1 is listed once to confirm

  @REQ-210 @SCN-210c
  Scenario: Confirming an answer given by hand
    Given Q2 answered by hand in `questions.md` and REQ-215 marked `Needs Clarification` for it
    When Q2 is confirmed in the studio
    Then Q2 is reviewed, REQ-215 no longer says `Needs Clarification`, and Q2 no longer blocks approval
