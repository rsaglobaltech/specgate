Feature: The board follows the change's phase

  @REQ-305 @SCN-305a
  Scenario: A change whose first requirement is being built
    Given the open change `alerts` with `ticket: FLEET-12` and a branch `harness/REQ-040` for its requirement REQ-040
    When `specgate alm sync` runs twice
    Then FLEET-12 is moved once to the provider's building state, and the second run reports it in sync without a request

  @REQ-305 @SCN-305b
  Scenario: A board with its own states
    Given `phases: { building: "Doing" }` in `alm.config.yaml` and the change `alerts` being built
    When `specgate alm sync --dry-run` runs
    Then it prints that FLEET-12 would move to "Doing", and nothing is sent to the board
