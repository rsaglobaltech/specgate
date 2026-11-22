@change:brief-domain-views
Feature: The domain model exported to DDD Toolbox

  @REQ-659 @SCN-659a
  Scenario: The claims workshop, there and back
    Given the claims workshop imported
    When the Developer runs `specgate brief export` and imports the boards it wrote into an empty project
    Then the three canvases, the Event Storming board and the story are written, and read back they give the same three contexts, 26 flows and the 26 activities in order
