Feature: Vehicle Entry
  Scenario: Registering vehicle entry with available slot
    Given a vehicle with plate "ABC-123" arrives at gate "North"
    And there are available parking spots
    When the access control validates the vehicle
    Then the system should register vehicle entry
    And assign a parking ticket id
