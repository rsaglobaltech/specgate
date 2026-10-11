Feature: Outside the geofence

  @REQ-701 @SCN-702
  Scenario: Outside the geofence
    Given a worker assigned to the jobsite "Mission Bay Tower" with a 100 m geofence
    When they clock in 650 m away
    Then the clock-in is refused and the worker is told they are 550 m outside the jobsite
