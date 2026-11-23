Feature: `status --json` carries the use cases, their specifications and diagrams

  @REQ-635 @SCN-635a
  Scenario: The use cases in status
    Given a project with UC-004 in the catalog and its specification naming SCN-012
    When a client runs `specgate status --json`
    Then `useCases.diagram` is a Mermaid flowchart, and UC-004 carries docs/specs/use-cases/UC-004.md, its main flow naming SCN-012 and its activity; with no catalog, `useCases` is null
