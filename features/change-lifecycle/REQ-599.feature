Feature: The design layer, by the change's rigor

  @REQ-599 @SCN-599a
  Scenario: The template answers nothing
    Given a change whose Discover lists AC-1 and AC-2, and whose design.md is the template plus a line answering AC-2
    When the change is validated
    Then design.md is said not to answer AC-1, and AC-2 is answered

  @REQ-599 @SCN-599b
  Scenario: Lite: no design owed
    Given a change at rigor lite whose design.md is as scaffolded
    When the change is validated and its status read
    Then no design finding is given, and the design is skipped

  @REQ-599 @SCN-599c
  Scenario: Full: the design is owed
    Given a change at rigor full whose design.md is as scaffolded
    When the change is validated and its approvals read
    Then layer_design_not_written is given, and the change is not approved: its design is not written
