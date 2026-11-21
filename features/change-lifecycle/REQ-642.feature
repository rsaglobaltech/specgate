Feature: The lanes reach the agent that drafts and the studio

  @REQ-642 @SCN-642a
  Scenario: The guide asks for it
    Given a brief with the module bookings
    When the Developer runs `specgate draft bookings`
    Then DRAFTING.md says to start a step with `[Who]`, its example has a step tagged [System] and System among the actors

  @REQ-642 @SCN-642b
  Scenario: Carried to the studio
    Given UC-004 with Tutor and System, step 2 tagged [System]
    When the Developer runs `specgate status --json`
    Then its main flow's lanes are Tutor and System, its steps keep no tag, and its activity has System's lane
