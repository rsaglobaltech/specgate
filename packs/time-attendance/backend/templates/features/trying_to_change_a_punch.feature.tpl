Feature: Trying to change a punch

  @REQ-703 @SCN-704
  Scenario: Trying to change a punch
    Given a worker inside the geofence of "Mission Bay Tower"
    When they clock in and someone later tries to change the punch time
    Then the punch keeps all its evidence and the change is refused
