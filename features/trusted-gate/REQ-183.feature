Feature: The gate fills the test command's placeholders outside the harness

  @REQ-183 @SCN-183a
  Scenario: check runs it for the whole project
    Given the test command `npm test && node e2e-names.mjs {req} {scenario} {feature_file}`
    When `specgate check` plans its gate
    Then it runs `npm test && node e2e-names.mjs`

  @REQ-183 @SCN-183b
  Scenario: done and apply run it for their requirement
    Given the test command `npm test && node e2e-names.mjs {req}`
    When REQ-007 is delivered
    Then the gate runs `npm test && node e2e-names.mjs REQ-007`
