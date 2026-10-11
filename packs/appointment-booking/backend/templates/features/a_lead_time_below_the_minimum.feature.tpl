Feature: A lead time below the minimum

  @REQ-507 @SCN-510
  Scenario: A lead time below the minimum
    Given the owner of "Salon 1"
    When they set a lead time of 0 hours
    Then the response is 422 and the lead time is unchanged
