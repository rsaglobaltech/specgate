@change:use-case-diagrams
Feature: The use-case diagram and each use case's activity diagram are generated

  @REQ-634 @SCN-634a
  Scenario: The Mermaid diagrams
    Given UC-002 and UC-004 for Tutor, and UC-004's specification with three steps and A1 at step 3 naming SCN-013
    When specgate generates the diagrams
    Then use-case-diagrams.md links Tutor to UC-002 and UC-004 in order, and UC-004's activity runs start → steps → end labelled SCN-012, with A1 branching from step 3 to the end

  @REQ-634 @SCN-634b
  Scenario: The PlantUML export
    Given the same use cases and specification
    When specgate generates the diagrams
    Then use-cases.puml has the actor, the use cases inside System and their links, and UC-004's activity with A1 as a branch at step 3

  @REQ-634 @SCN-634c
  Scenario: Regenerated, and a hand edit reported
    Given a project with UC-004 and its specification
    When the diagrams are regenerated, and then use-cases.puml is edited by hand
    Then both files are written once, nothing the second time, and `use_case_diagrams_stale` names use-cases.puml
