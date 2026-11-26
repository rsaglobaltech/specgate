Feature: Sealing acceptance tests runs them once for the person

  @REQ-794 @SCN-794a
  Scenario: A wrong path
    Given `acceptance_cmd` set, and an acceptance test that loads `../../../src/fees.js` from two folders deep
    When a person runs `specgate change approve draft-fees --layer acceptance`
    Then the tests are sealed, the output says they ran once, and shows `Cannot find module '../../../src/fees.js'`
