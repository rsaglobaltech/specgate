@change:brief-surfaces
Feature: The agent's front matter is fixed before it is shown

  @REQ-653 @SCN-653a
  Scenario: A service left with no surfaces
    Given an agent whose first front matter gives "Servicio de transcripción" no surfaces, and which fixes a problem it is told
    When the Developer runs `specgate draft --agent <it> --json`
    Then the agent ran twice, the second time told brief_actor_without_surfaces, and the brief says `{ name: Servicio de transcripción, surfaces: [api] }` with no problem left and its body unchanged

  @REQ-653 @SCN-653b
  Scenario: The guide says it
    Given any brief
    When the agent's guide is written
    Then it says a system the brief names uses `api` and an actor's surfaces are never empty
