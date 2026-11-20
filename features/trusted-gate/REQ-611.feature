Feature: A delivery says everything to rewrite in one refusal

  @REQ-611 @SCN-611a
  Scenario: Fresh from new
    Given an adopted project and REQ-002 as `specgate new` wrote it, with a test that names it
    When the developer runs `specgate apply REQ-002`
    Then it is refused once, naming `scenario_placeholder_step` and `requirement_template_obligation`

  @REQ-611 @SCN-611b
  Scenario: Both rewritten
    Given the same requirement with its scenario's steps and its obligation written
    When the developer runs `specgate apply REQ-002`
    Then REQ-002 is marked Implemented
