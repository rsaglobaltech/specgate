Feature: An answered question its requirement does not reflect is a finding

  @REQ-262 @SCN-262a
  Scenario: Q5 answered, REQ-010 still blocked
    Given `questions.md` where Q5 blocks REQ-010 and its Answer cell says "Hasta dos conductores por camión", and REQ-010 still `Needs Clarification`
    When the draft is checked
    Then a finding names Q5 and REQ-010 and says to fold the answer into REQ-010 and drop its status
