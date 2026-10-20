Feature: The new brief has cards to fill

  @REQ-139 @SCN-139a
  Scenario: The template, checked as written
    Given a project with no brief
    When the developer runs `specgate propose --from-brief --new-brief` and then `specgate propose --from-brief --check`
    Then `docs/brief.md` holds `## Module: <first-module>` with "Rules", "Examples" and "Questions", and the check exits 1 with `brief_placeholder` and `B2_empty_module` findings and no `B3_no_section`
