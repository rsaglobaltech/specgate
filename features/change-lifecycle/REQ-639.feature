Feature: State machines reach PlantUML, the studio and the agent that drafts

  @REQ-639 @SCN-639a
  Scenario: PlantUML of a machine
    Given GenerationRequest
    When specgate renders it
    Then the PlantUML starts in Received, labels Validating → Authorized with `validate [safe]` and REQ-011, ends from Available, and notes Rejected → Available as forbidden

  @REQ-639 @SCN-639b
  Scenario: Written and carried
    Given Order's machine
    When the Developer runs `specgate check`, then `specgate status --json`
    Then docs/specs/state-machines/Order.puml holds its transitions and status lists Order with its file, its PlantUML and its transitions

  @REQ-639 @SCN-639c
  Scenario: The guide asks for it
    Given a brief with the module bookings
    When the Developer runs `specgate draft bookings`
    Then DRAFTING.md has "1d. An entity's states" with ADDED States, ADDED Transitions with their Requirement column, and ADDED Forbidden

  @REQ-639 @SCN-639d
  Scenario: A draft's machine checked
    Given the draft of bookings writing Booking's machine with a transition into Confirmd naming REQ-404
    When the Developer runs `specgate draft bookings`
    Then it is not ready, naming D16_sm_unknown_requirement, then D16_sm_unknown_state; once corrected it is ready to review
