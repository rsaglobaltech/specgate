Feature: A repository leaves another's requirement to the workspace

  @REQ-294 @SCN-294a
  Scenario: A repository leaves another's id to the workspace
    Given REQ-002 declares depends=contracts:REQ-003 and depends=REQ-001
    When the repository's dependency graph is built
    Then REQ-002 depends on REQ-001, nothing is unknown, and contracts:REQ-003 is left to the workspace
