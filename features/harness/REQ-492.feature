Feature: The API asks a run to stop as the command does

  @REQ-492 @SCN-492a
  Scenario: In-process and from the command line
    Given a project where a harness run holds the run lock
    When a program calls `harnessStop(dir, { afterCurrent: true })`, and later, with no run, both it and `specgate harness stop --after-current --json` answer
    Then the first answer has `requested` true with the run's pid and the stop request exists; the two later answers are equal, with `requested` false
