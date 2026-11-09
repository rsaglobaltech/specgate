Feature: Studio is an app you use without the commands

  @REQ-204 @SCN-204a
  Scenario: The app and its sections
    Given studio is running
    When its root is opened, then Questions is chosen, then the page is reloaded
    Then the page lists Home, Brief, Changes, Questions, Build, Live, Report and Settings, carries its token, and opens Questions again after the reload

  @REQ-204 @SCN-204b
  Scenario: Writes need the token
    Given studio is running
    When an app action is posted without the page's token
    Then it is refused with 403
