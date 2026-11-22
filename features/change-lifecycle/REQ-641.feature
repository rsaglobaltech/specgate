@change:use-case-lanes
Feature: A use case's activity is drawn with a lane per actor

  @REQ-641 @SCN-641a
  Scenario: Lanes in Mermaid
    Given UC-007's specification
    When specgate draws its activity in Mermaid
    Then it has a subgraph for Child holding steps 1 and 2, one for Safety service holding step 4, and one for PintaMundo holding A1's step

  @REQ-641 @SCN-641b
  Scenario: Lanes in PlantUML
    Given UC-007's specification
    When specgate writes its activity in PlantUML
    Then it starts in |Child| and switches to |PintaMundo| and |Safety service| where the steps do, A1's step under |PintaMundo|
