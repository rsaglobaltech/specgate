@change:state-machines
Feature: A change's delta to a state machine is applied at archive

  @REQ-638 @SCN-638a
  Scenario: Added, modified, lifted
    Given GenerationRequest and a delta adding Paused with Authorized → Paused and back, modifying Available and Authorized → Available, and removing the forbidden Rejected → Available
    When the delta is applied
    Then the machine has Paused and its two transitions, Available's new behaviour, Authorized → Available naming REQ-011 and REQ-018, no forbidden transition, and nothing to fix

  @REQ-638 @SCN-638b
  Scenario: What a delta cannot remove
    Given a delta removing Rejected, which Validating → Rejected uses, and Expired and Received → Authorized, which do not exist
    When specgate checks the delta
    Then it names sm_state_in_use with Validating → Rejected, sm_state_unknown and sm_transition_unknown

  @REQ-638 @SCN-638c
  Scenario: A requirement left out
    Given a delta removing Validating → Rejected, the only transition naming REQ-046
    When specgate checks the delta
    Then it warns sm_requirement_uncovered for REQ-046

  @REQ-638 @SCN-638d
  Scenario: Paused added to the machine at archive
    Given a change adding REQ-050 and Paused with Validating → Paused and back naming REQ-050
    When the Developer archives it
    Then docs/specs/state-machines/GenerationRequest.md has Paused and its transitions, and keeps the others

  @REQ-638 @SCN-638e
  Scenario: Refused at archive
    Given a change removing Rejected, which a transition uses, and adding a transition naming REQ-099
    When the Developer archives it
    Then archive refuses it with sm_state_in_use and sm_unknown_requirement, and the machine is unchanged
