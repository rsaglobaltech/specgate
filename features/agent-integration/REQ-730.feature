@change:compat-honest
Feature: A run in which the tool never worked is invalid, not failed

  @REQ-730 @SCN-730a
  Scenario: The provider refused
    Given a fake opencode that prints an error event "Free usage limit reached" and does nothing
    When the Developer runs `specgate compat run --tool opencode --level L0 --runs 1`
    Then the run is recorded invalid with that reason, and the report's cell for opencode at L0 has no runs and says 1 invalid

  @REQ-730 @SCN-730b
  Scenario: Not asked a third time
    Given a fake opencode whose provider refuses every run
    When the Developer runs `specgate compat run --tool opencode --level L0,L1 --runs 3`
    Then two runs are recorded, both invalid, and the command says opencode was stopped after two invalid runs

  @REQ-730 @SCN-730c
  Scenario: An agent that worked and failed is still a failure
    Given a fake opencode that writes a wrong src/fees.js and then prints an error event
    When the run is judged
    Then the run is valid and failed
