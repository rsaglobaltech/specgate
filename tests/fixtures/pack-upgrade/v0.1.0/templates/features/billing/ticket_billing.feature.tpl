Feature: Parking Billing
  Scenario: Calculating parking fee at exit
    Given vehicle "ABC-123" entered at "10:00"
    And vehicle "ABC-123" exits at "12:30"
    When the parking fee is calculated
    Then the total fee should be calculated using configured tariff rules
    And a "ParkingFeeCalculated" event should be emitted
