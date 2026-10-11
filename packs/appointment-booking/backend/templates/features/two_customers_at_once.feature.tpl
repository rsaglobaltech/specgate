Feature: Two customers at once

  @REQ-505 @SCN-507
  Scenario: Two customers at once
    Given "Hair" with 1 free seat at 10:00
    When two customers book at 10:00 at the same time
    Then one response is 201 and the other 409
