Feature: Desktop baseline availability
  @REQ-000 @SCN-000
  Scenario: The main window opens
    Given the desktop application is installed
    When I start it
    Then I should see the main window with the application shell
