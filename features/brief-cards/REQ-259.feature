Feature: The root brief's text goes below the front matter

  @REQ-259 @SCN-259a
  Scenario: The client's brief pushed first, forja's template beside it
    Given `brief.md` at the root with the client's text, and `docs/brief.md` with forja's front matter and its "Paste the client's brief here" body
    When `specgate draft` runs
    Then `docs/brief.md` holds forja's front matter followed by the client's text, `brief.md` is still at the root, and the output says the text was put there

  @REQ-259 @SCN-259b
  Scenario: A body the person wrote is left alone
    Given `brief.md` at the root, and `docs/brief.md` whose body is a brief the person wrote
    When `specgate draft` runs
    Then `docs/brief.md` is unchanged
