Feature: The sandbox's network is its provider and the registry

  @REQ-737 @SCN-737a
  Scenario: Other providers closed
    Given a fake sbx whose kit allows api.anthropic.com, api.openai.com, opencode.ai and registry.npmjs.org
    When a sandbox for opencode is made
    Then deny rules were added for api.anthropic.com and api.openai.com, none for opencode.ai or registry.npmjs.org, and the run records opencode.ai and registry.npmjs.org as open
