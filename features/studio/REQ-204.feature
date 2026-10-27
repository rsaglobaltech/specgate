Feature: Studio is an app you use without the commands

  @REQ-204 @SCN-204a
  Scenario: The app and its sections
    Given studio is running
    When its root is opened
    Then the page has Home, Questions, Review and Build, a simple/advanced switch and a Spanish/English switch, and carries its token

  @REQ-204 @SCN-204b
  Scenario: Writes need the token
    Given studio is running
    When an app action is posted without the page's token
    Then it is refused with 403
