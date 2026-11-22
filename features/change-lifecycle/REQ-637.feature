@change:state-machines
Feature: Each entity's state machine is read and checked against the requirements

  @REQ-637 @SCN-637a
  Scenario: A machine read
    Given GenerationRequest with Received initial, Validating, Authorized, Available and Rejected final, four transitions naming REQ-011, REQ-046 and REQ-018, and Rejected → Available forbidden by REQ-034
    When specgate reads it
    Then it has the five states with their behaviour, the transitions with their requirements, the forbidden one, and nothing to fix

  @REQ-637 @SCN-637b
  Scenario: What a machine cannot hold
    Given a transition into Availible naming REQ-099, and Rejected → Available as a transition
    When specgate checks the machine
    Then it names sm_unknown_state, sm_unknown_requirement and sm_forbidden_used as errors

  @REQ-637 @SCN-637c
  Scenario: What a machine is warned about
    Given Expired final that no transition reaches, Rejected not final with no way out, and Authorized → Available naming no requirement
    When specgate checks the machine
    Then it warns sm_unreachable for Expired, sm_dead_end for Rejected and sm_transition_untraced

  @REQ-637 @SCN-637d
  Scenario: A machine that holds, at the gate
    Given Order with Paid → Cancelled naming REQ-002 and Paid → Shipped naming none
    When the Developer runs `specgate validate . --strict --json`
    Then the gate passes and reports sm_transition_untraced

  @REQ-637 @SCN-637e
  Scenario: A machine that does not hold, at the gate
    Given Order with Paid → Shipped naming REQ-404 and Shipped → Cancelled, which it forbids
    When the Developer runs `specgate validate . --strict`
    Then the gate fails naming sm_forbidden_used, sm_unknown_requirement and docs/specs/state-machines/Order.md; under the minimal preset it reports them and passes
