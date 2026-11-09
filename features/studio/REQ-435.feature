Feature: The studio is used with the keyboard and a screen reader

  @REQ-435 @SCN-435a
  Scenario: Answering with the keyboard
    Given the studio open on Questions with Q1 open
    When the viewer moves with Tab to Q1's answer, types it and presses Enter
    Then the answer is saved, the focus stays on Q1, and a notice is announced once
