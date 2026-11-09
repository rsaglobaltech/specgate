Feature: draft explains the front matter it needs

  @REQ-246 @SCN-246a
  Scenario: forja's template, modules empty
    Given `docs/brief.md` with forja's front matter: actor `Customer` and `modules: []`, and the client's text below
    When `specgate draft` runs
    Then it explains the four fields, says `Customer` looks like the template's, and names `specgate draft --agent`
