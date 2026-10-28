Feature: The studio's Build follows the gate's steps

  @REQ-275 @SCN-275a
  Scenario: Building while a quality check runs
    Given the studio page
    When it is served
    Then its Build reads `gate-start` events, puts a `quality:` step in the third stage, and shows the running step's name
