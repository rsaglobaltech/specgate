Feature: Parking Capacity
  Scenario: Triggering alert when occupancy reaches threshold
    Given a parking facility "Lot-A" with total capacity of "200" spots
    And current occupancy is "180" vehicles
    When 10 more vehicles enter the facility
    Then occupancy should become "190" vehicles
    And a "CapacityThresholdReached" event should be emitted
