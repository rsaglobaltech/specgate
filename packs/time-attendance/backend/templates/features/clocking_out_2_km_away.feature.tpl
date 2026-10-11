Feature: Clocking out 2 km away

  @REQ-702 @SCN-703
  Scenario: Clocking out 2 km away
    Given a worker clocked in at "Mission Bay Tower"
    When they clock out 2 km away
    Then the clock-out is recorded with the flag OUTSIDE_GEOFENCE
