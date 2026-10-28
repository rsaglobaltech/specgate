Feature: No inline code split across lines in the changelog

  @REQ-195 @SCN-195a
  Scenario: Every code span on one line
    Given CHANGELOG.md
    When its lines outside code fences are read
    Then none has an odd number of backticks
