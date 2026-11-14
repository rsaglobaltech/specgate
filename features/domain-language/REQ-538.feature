Feature: The glossary keeps one word for one thing

  @REQ-538 @SCN-538a
  Scenario: A requirement says "client"
    Given a glossary with the term `Customer` whose `Avoid` column lists `client`, and REQ-001 whose text says "a client downloads the invoice"
    When a tool runs `specgate validate --json`
    Then it reports `glossary_term_forbidden` for `client` on REQ-001's line, with `Customer` as the term to use
