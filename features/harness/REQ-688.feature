@change:agent-routing
Feature: A module has its own agent

  @REQ-688 @SCN-688a
  Scenario: ausleihe with its own agent
    Given profiles `careful` with `match: { module: ausleihe }` and `cheap` with `match: { module: "*" }`, and REQ-006 of ausleihe and REQ-004 of katalog pending
    When the harness builds them
    Then REQ-006 is built by careful's agent and REQ-004 by cheap's
