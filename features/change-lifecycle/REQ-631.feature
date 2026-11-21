Feature: Each use case has a specification whose flows name the scenarios that prove them

  @REQ-631 @SCN-631a
  Scenario: A specification read
    Given UC-004's specification with an overview, Tutor, a precondition, a main flow of three steps naming SCN-012, A1 at step 3 naming SCN-013, a postcondition and a rule naming REQ-014
    When specgate reads it
    Then it has each section, the two flows with their steps and scenarios, and nothing to fix when its requirements' scenarios are SCN-012 and SCN-013

  @REQ-631 @SCN-631b
  Scenario: A scenario no flow names
    Given UC-004's A1 naming SCN-099, and its requirements' scenarios SCN-012 and SCN-013
    When specgate checks it
    Then it names SCN-099 as no scenario of UC-004 and SCN-013 as named by no flow

  @REQ-631 @SCN-631c
  Scenario: The specification archived
    Given a change adding UC-007 with REQ-001, and its use-cases/UC-007.md whose main flow names SCN-001a
    When the Developer archives it
    Then docs/specs/use-cases/UC-007.md holds the specification
