Feature: The matrix answers one row per scenario

  @REQ-498 @SCN-498a
  Scenario: Two scenarios, one with its test and code, one without
    Given a derived project whose REQ-001 has the scenarios SCN-001a and SCN-001b in `features/orders/REQ-001.feature`, a test that names REQ-001 and code that names REQ-001, and whose REQ-002 has a feature and no test or code
    When a tool runs `specgate matrix --json --dry-run` and calls `matrix(dir)`
    Then both list a row for SCN-001a and one for SCN-001b with the feature, the test and the code and no gap, and a row for REQ-002 whose `gaps` are `test` and `code`

  @REQ-498 @SCN-498b
  Scenario: Q2 blocks REQ-002
    Given that project with the open change `draft-orders`, whose open question Q2 blocks REQ-002
    When a tool runs `specgate matrix --json --dry-run`
    Then REQ-002's row has `waiting` with `question` Q2 and `change` `draft-orders`, and REQ-001's rows have `waiting` null
