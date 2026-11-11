Feature: check --affected runs the tests of what the change touches

  @REQ-510 @SCN-510a
  Scenario: One requirement's code changed on a branch
    Given a git project on `main` whose REQ-001 and REQ-002 each have a source file and a test file that name them, with `test_cmd` `node run-tests.js {files}`, and a branch where only REQ-001's source file changed
    When a tool runs `specgate check --affected --json`
    Then it exits 0, `selection.mode` is `affected`, `requirements` is `["REQ-001"]`, `tests` is REQ-001's test file alone, and the tests stage ran `node run-tests.js` with that one file
