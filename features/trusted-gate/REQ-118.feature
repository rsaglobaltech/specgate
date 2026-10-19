Feature: Only a requirement heading needs a matrix row

  @REQ-118 @SCN-118a
  Scenario: An id mentioned in prose
    Given a capability spec whose prose says "replaces REQ-003" inside a sentence and a fenced example that names REQ-002, neither declared by a heading in that spec
    When the developer runs `specgate validate . --strict`
    Then no TDD-3 finding names REQ-003 or REQ-002 for those mentions
    And a `### Requirement: REQ-004` heading with no row still fails TDD-3
