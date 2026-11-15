Feature: The last gate result is kept and read back

  @REQ-504 @SCN-504a
  Scenario: No check yet, then a failed one
    Given a git repository with a specgate project where no check has run
    When a tool runs `specgate check --last --json`, then `specgate check` with a failing test command, then `specgate check --last --json` and calls `lastCheck(dir)`
    Then the first answer has `lastCheck` null and `last_check_none` with the fix `specgate check`; the second says the check failed, at what time and on the commit `git rev-parse HEAD` prints, with its `tests` stage `failed`; `lastCheck(dir)` gives the same; and `git status --porcelain` shows nothing new
