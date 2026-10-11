Feature: A radius out of range

  @REQ-707 @SCN-710
  Scenario: A radius out of range
    Given a signed-in administrator and the jobsite "Mission Bay Tower"
    When they set the radius to 20 m
    Then the response is 422 with the error "radius_out_of_range"
