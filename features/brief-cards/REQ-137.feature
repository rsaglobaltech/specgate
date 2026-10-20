Feature: Module sections are each module's scope

  @REQ-137 @SCN-137a
  Scenario: A missing and an unknown section
    Given a brief with `modules: [courses, lessons]`, a filled courses section, and a section "## Module: billing"
    When the developer runs `specgate propose --from-brief --check`
    Then it reports `B3_no_section` for lessons and `B3_unknown_module` for billing, and exits 1

  @REQ-137 @SCN-137b
  Scenario: Rules without examples
    Given a courses section with two rules and no example
    When the developer runs `specgate propose --from-brief --check`
    Then it reports `B4_no_example` for courses, and exits 1

  @REQ-137 @SCN-137c
  Scenario: A pasted email
    Given a brief with a complete front matter and the client's email below it, with no module section
    When the developer runs `specgate propose --from-brief --check`
    Then it exits 0, and its only finding is the note `B3_no_sections`
