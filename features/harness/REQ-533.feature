Feature: Each role stays in its lane

  @REQ-533 @SCN-533a
  Scenario: The implementer rewrites a test
    Given the project of SCN-532a and an agent that, as tester, writes `tests/a.test.js`, and as implementer writes `src/a.js` and overwrites `tests/a.test.js`
    When a tool runs `specgate harness run --req REQ-000`
    Then the output reports `lane_crossed` for `implementer` and `tests/a.test.js`, and the tester's content of `tests/a.test.js` is what the gate ran
