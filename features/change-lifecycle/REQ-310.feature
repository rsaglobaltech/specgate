Feature: The roles of a project

  @REQ-310 @SCN-310a
  Scenario: Ana holds the product role
    Given `roles: { product: [ana@acme.eu], architect: [carlos@acme.eu] }` and a git identity `ana@acme.eu`
    When the roles of that person are asked for
    Then they are product and developer — developer because nobody is named for it — and not architect
