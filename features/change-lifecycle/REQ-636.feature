@change:use-case-diagrams
Feature: `propose --use-cases` proposes the use cases of requirements delivered before the catalog

  @REQ-636 @SCN-636a
  Scenario: The change opened, and written by the agent
    Given a project whose catalog holds only the template, and REQ-002 delivered with no use case
    When the Developer runs `specgate propose --use-cases`, then with `--agent` an agent that writes UC-002 with REQ-002 and its specification, and a file outside the change
    Then the change lists REQ-002 as uncovered and is not ready; after the agent it is ready, and the file outside it is undone

  @REQ-636 @SCN-636b
  Scenario: Approved and archived
    Given the change with UC-002 and its specification written
    When the Developer approves and archives it, and runs `specgate propose --use-cases` again
    Then the catalog has UC-002 with REQ-002 and no template row, docs/specs/use-cases/UC-002.md exists, and every requirement is said to be in a use case
