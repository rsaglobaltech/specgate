Feature: An agent reads and moves a change's phase over MCP

  @REQ-309 @SCN-309a
  Scenario: An agent drives the board
    Given the change `alerts` with `ticket: FLEET-12` and a requirement being built
    When an agent calls the MCP tools `specgate_alm_phase` and then `specgate_alm_move` for `alerts`
    Then the first answers `building` with FLEET-12 and no board state yet, and the second moves FLEET-12 to the building state
