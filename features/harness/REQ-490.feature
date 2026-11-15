Feature: A run on a dirty tree, when asked, says what it left out

  @REQ-490 @SCN-490a
  Scenario: An uncommitted note stays out of the run
    Given a committed project with `notes.md` untracked and `README.md` edited and not committed
    When `specgate harness run --allow-dirty --format json` delivers REQ-000 with a fake agent
    Then REQ-000 passes, its branch has no `notes.md`, the result has `dirty.allowed` true and `dirty.leftOut` listing `README.md` and `notes.md`, and both files are still in the working copy as they were

  @REQ-490 @SCN-490b
  Scenario: Without the flag, or with --chain
    Given the same dirty project
    When `specgate harness run --format json` runs, and then `specgate harness run --allow-dirty --chain --format json`
    Then the first is refused with `harness_run_error` and a message that names `--allow-dirty`, and the second is refused because `--chain` merges into the working copy
