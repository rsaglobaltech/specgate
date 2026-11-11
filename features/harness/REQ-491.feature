Feature: Stopping a run after the requirement in progress, from the command line

  @REQ-491 @SCN-491a
  Scenario: The run stops after REQ-000
    Given a run of REQ-000, REQ-001 and REQ-002 whose agent for REQ-000 runs `specgate harness stop --after-current --json`
    When the run ends
    Then the stop answered `requested` true with the run's pid, REQ-000 passed, REQ-001 and REQ-002 were not attempted, and the run's JSON has `stopped.by` `request` and `stopped.notAttempted` REQ-001 and REQ-002

  @REQ-491 @SCN-491b
  Scenario: No run to stop
    Given a project where no harness run is working
    When `specgate harness stop --after-current --json` runs, and `specgate harness stop --json` without the flag
    Then the first exits 0 with `requested` false and the warning `harness_not_running`, and writes no stop request; the second is a usage error whose fix names `--after-current`
