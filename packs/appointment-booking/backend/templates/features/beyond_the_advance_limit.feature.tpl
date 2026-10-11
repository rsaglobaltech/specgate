Feature: Beyond the advance limit

  @REQ-508 @SCN-511
  Scenario: Beyond the advance limit
    Given "Salon 1" with an advance limit of 30 days
    When a customer books 31 days ahead
    Then the response is 422 and no booking is created
