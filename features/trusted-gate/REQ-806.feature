Feature: A requirement is drawn before and after, the same way every time

  @REQ-806 @SCN-806a
  Scenario: A call added to a flow
    Given REQ-031 whose scenario at the base sends `POST /api/orders`, and now also `POST /api/payments`
    When its diagrams are drawn
    Then the before has one call and the after two, both from the actor to the system

  @REQ-806 @SCN-806b
  Scenario: A method added to a class
    Given `src/orders.ts`, linked to REQ-031, whose class `Orders` has `place()` at the base and `place()` and `refund()` now
    When its diagrams are drawn
    Then the after's class `Orders` lists `refund()`, marked as added
