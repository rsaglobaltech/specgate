Feature: The studio runs the commands it offers, and only those

  @REQ-438 @SCN-438a
  Scenario: An offered command runs, anything else is refused
    Given a studio open on a project with the change `draft-orders`
    When the page asks to preview archiving `draft-orders`, and then to run `rm -rf .` and to archive a change id with `../` in it
    Then the preview runs `specgate archive draft-orders --dry-run` and its output is shown, and the other two are refused, naming why, and run nothing
