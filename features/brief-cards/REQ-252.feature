Feature: An incomplete front matter is called incomplete

  @REQ-252 @SCN-252a
  Scenario: forja's front matter, modules empty
    Given forja's front matter with `modules: []`
    When `specgate draft` runs
    Then it says the front matter is incomplete and does not say "no front matter yet"
