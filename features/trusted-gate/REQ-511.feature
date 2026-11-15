Feature: A change to what every test depends on runs the whole suite

  @REQ-511 @SCN-511a
  Scenario: The lockfile changed
    Given the project of SCN-510a on a branch where REQ-001's source file and `package-lock.json` changed
    When a tool runs `specgate check --affected --json`
    Then `selection.mode` is `full`, its `reason` names `package-lock.json`, and the tests stage ran `node run-tests.js` with no file
