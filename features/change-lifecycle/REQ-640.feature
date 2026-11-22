@change:use-case-lanes
Feature: Each step of a use case says who does it

  @REQ-640 @SCN-640a
  Scenario: Lanes read
    Given UC-007 with Child, PintaMundo and Safety service as actors, steps tagged [Child], untagged, [PintaMundo], [Safety service], [PintaMundo], and A1 tagged [PintaMundo]
    When specgate reads it
    Then the main flow's lanes are Child, Child, PintaMundo, Safety service and PintaMundo, A1's is PintaMundo, the steps keep no tag, and there is nothing to fix

  @REQ-640 @SCN-640b
  Scenario: A lane no actor names
    Given the same specification with step 4 tagged [Moderator]
    When specgate checks it
    Then it names ucs_unknown_lane for Moderator
