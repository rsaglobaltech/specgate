Feature: A brief at the root is pointed at

  @REQ-251 @SCN-251a
  Scenario: The client's brief pushed first, forja's template beside it
    Given `brief.md` at the root with the client's text, and `docs/brief.md` with forja's front matter and template body
    When `specgate status` and `specgate draft` run
    Then both name `brief.md` at the root and `docs/brief.md` as where its text goes
