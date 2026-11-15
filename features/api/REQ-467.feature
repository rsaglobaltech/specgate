Feature: The API only reads

  @REQ-467 @SCN-467a
  Scenario: A derived matrix behind its specs
    Given a derived project whose `docs/specs/traceability.md` is behind its capability specs
    When a program calls `matrix(dir)`
    Then the answer counts the rows as they would be derived and says nothing was written, and `traceability.md` is unchanged byte for byte
