Feature: The draft starts from its module's cards

  @REQ-140 @SCN-140a
  Scenario: The courses cards
    Given a brief whose courses section has the rule "A course holds at most 12 students.", the rule 'When a course is full, joining it is refused with "This course is full".' and the question "Can a student be in two courses at once?"
    When the developer runs `specgate propose --from-brief courses`
    Then `DRAFTING.md` quotes both rules, lists 12 and "This course is full" as values to use, and lists the question for `questions.md`

  @REQ-140 @SCN-140b
  Scenario: A value only in a comment
    Given a brief whose only "48" is inside "<!-- e.g. 48 hours -->", and a draft scenario stating 48
    When the developer runs `specgate propose --from-brief courses` on the draft
    Then it reports `D6_unlisted_value` for 48
