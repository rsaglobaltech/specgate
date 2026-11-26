Feature: The model ladder and the cost per delivered requirement

  @REQ-725 @SCN-725a
  Scenario: Green at the first step
    Given claude with haiku green on `trap` at L3
    When the Developer runs `specgate compat run --ladder --tool claude --task trap --level L3`
    Then sonnet is not run for it

  @REQ-725 @SCN-725b
  Scenario: One step up
    Given claude with haiku red on `trap` at B and sonnet green
    When the ladder ends
    Then the report says the cheapest green model for claude on `trap` is sonnet at B and haiku at L3
