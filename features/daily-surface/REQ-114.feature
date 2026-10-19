Feature: The four verbs and check speak JSON

  @REQ-114 @SCN-114a
  Scenario: One document per verb
    Given a project with an open change and one pending requirement
    When an agent runs each of `propose`, `apply`, `status`, `archive` and `check` with `--json`
    Then each stdout parses as exactly one JSON document carrying the command's own key and a `status` array of diagnostics (ADR-0017), whether the command succeeded or was refused
