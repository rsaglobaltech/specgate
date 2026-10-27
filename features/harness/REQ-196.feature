Feature: The harness and its tests work on Windows

  @REQ-196 @SCN-196a
  Scenario: A Cucumber filter that matches nothing fails the gate on Windows
    Given a test command `npx cucumber-js --tags "@does-not-exist"`
    When the harness runs the gate on Windows
    Then it fails at "cucumber messages", as on Linux
