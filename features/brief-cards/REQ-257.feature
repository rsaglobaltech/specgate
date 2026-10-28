Feature: The incomplete front matter is explained in a sentence

  @REQ-257 @SCN-257a
  Scenario: forja's front matter, modules empty
    Given forja's front matter with `modules: []`
    When `specgate draft` runs
    Then it says "These are the four fields that tell Specgate what to draft"
