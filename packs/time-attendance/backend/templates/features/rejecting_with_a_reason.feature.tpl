Feature: Rejecting with a reason

  @REQ-705 @SCN-706
  Scenario: Rejecting with a reason
    Given a clock-out flagged OUTSIDE_GEOFENCE for a worker on the supervisor's crew
    When the supervisor rejects it with the reason "Left site at 15:10 per site log"
    Then the review is recorded as REJECTED with that reason and the punch is unchanged
