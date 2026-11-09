Feature: A "?" that says what a feature does in the background

  @REQ-452 @SCN-452a
  Scenario: What Ask for a change does
    Given a draft to review in Changes
    When the "?" beside Ask for a change is pressed with the keyboard
    Then an explanation opens saying the request is added to the change's review.md and the draft changes only when it is drafted again, the "?" says it is expanded, and Escape closes it and returns the focus to the "?"
