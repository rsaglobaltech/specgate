Feature: Capacity Waitlist
  Scenario: Joining the waitlist when the facility is full
    Given the facility is at full capacity
    And a driver with plate "XYZ-789" requests entry
    When the driver joins the waitlist
    Then the driver should be added to the waitlist at position 1
    And a "DriverWaitlisted" event should be emitted
