Feature: The log quotes what it read

  @REQ-003 @SCN-003a
  Scenario: A quoted line with vague words in it
    Given a build log whose last line is "TODO: something went wrong..."
    When the developer asks for the condensed log
    Then the developer sees the line "TODO: something went wrong..." under "Last line", and `etc` is not added
