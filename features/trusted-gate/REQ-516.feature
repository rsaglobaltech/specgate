Feature: A test that passed on the same code is not run again

  @REQ-516 @SCN-516a
  Scenario: The same check twice, then a change to the code under test
    Given the project of SCN-510a on its branch, where `specgate check --affected` passed
    When `specgate check --affected --json` runs again, then REQ-001's source file changes and it runs a third time, then it runs with `--no-cache`
    Then the second answer lists REQ-001's test file under `cached` and ran no test; the third ran it; the fourth ran it and cached nothing
