Feature: Gate tooling and exam fixtures are not code

  @REQ-696 @SCN-696a
  Scenario: The scenario runner mentions REQ-006
    Given `bdd_cmd: node scripts/scenarios.mjs` whose comment says `@REQ-006`, and no other code mentioning REQ-006
    When the Developer runs `specgate map --json`
    Then REQ-006 has 0 code files

  @REQ-696 @SCN-696b
  Scenario: An exam fixture is not a test
    Given `evals/conventions/tasks/t/test/baseline.test.js` naming REQ-001, beside `test/baseline.test.js`
    When the Developer runs `specgate matrix --json`
    Then REQ-001's tests are only `test/baseline.test.js`
