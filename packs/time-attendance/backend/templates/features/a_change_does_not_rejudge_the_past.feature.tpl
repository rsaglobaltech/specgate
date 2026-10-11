Feature: A change does not rejudge the past

  @REQ-707 @SCN-709
  Scenario: A change does not rejudge the past
    Given "Mission Bay Tower" with a 100 m geofence and a clock-in accepted 80 m from its centre
    When an administrator reduces the radius to 50 m
    Then the geofence is at version 2 and the earlier clock-in is still judged against version 1 as accepted
