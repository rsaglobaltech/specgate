Feature: Secrets stay out of what the run writes

  @REQ-582 @SCN-582a
  Scenario: A gate output with a key in it
    Given a run whose environment holds `MY_API_KEY` and whose output quotes it, a URL with a password and a GitHub token
    When the run writes its record
    Then none of the three appears in it; `***` does
