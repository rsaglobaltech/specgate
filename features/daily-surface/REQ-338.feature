Feature: A specification too big to review is said

  @REQ-338 @SCN-338a
  Scenario: Ten areas
    Given a repository whose src holds ten areas with source files
    When the developer runs `specgate adopt`
    Then it proposes eight and warns `adopt_too_big` naming the two left out and `adopt --scope`
