Feature: Inside the geofence

  @REQ-701 @SCN-701
  Scenario: Inside the geofence
    Given a worker assigned to the jobsite "Mission Bay Tower" with a 100 m geofence
    When they clock in 40 m from its centre with 12 m accuracy
    Then the punch is accepted with no flags
