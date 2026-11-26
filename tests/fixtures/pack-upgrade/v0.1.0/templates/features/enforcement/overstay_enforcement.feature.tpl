Feature: Overstay Enforcement
  Scenario: Flagging vehicles that exceed allowed parking duration
    Given vehicle "XYZ-999" has parked for "14" hours
    And allowed maximum parking duration is "12" hours
    When enforcement scan is executed
    Then the vehicle should be flagged for overstay
    And an "OverstayDetected" event should be emitted
