Feature: The test command takes the selected files

  @REQ-513 @SCN-513a
  Scenario: A command with no placeholder, then a path with a space
    Given the project of SCN-510a whose `test_cmd` is `node run-tests.js`, and REQ-001's test file at `test/my req.test.js`
    When a tool runs `specgate check --affected --json`, then sets `test_cmd_affected` to `node run-tests.js {files}` and runs it again
    Then the first answer has `selection.mode` `full` and the finding `affected_needs_files` naming `{files}`; the second ran `node run-tests.js` with `test/my req.test.js` as one argument
