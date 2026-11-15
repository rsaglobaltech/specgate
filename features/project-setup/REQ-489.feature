Feature: adopt --dry-run lists what adopt --yes writes

  @REQ-489 @SCN-489a
  Scenario: A Node project with no README.md
    Given two copies of a Node project with a `test` script, no README.md and no .gitattributes
    When `specgate adopt --dry-run` runs on one and `specgate adopt --yes` on the other
    Then the files the dry run lists are exactly the files the other run wrote, README.md and .gitattributes among them, and the first copy is unchanged
