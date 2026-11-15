Feature: A waiting requirement of an open change is the build order

  @REQ-396 @SCN-396a
  Scenario: Tracking's open change waits for contracts:REQ-002
    Given tracking's open change track-fleet has REQ-002 with `depends=contracts:REQ-002`, and contracts' REQ-002 is Draft
    When the developer runs `specgate workspace check --json`
    Then `workspace_dependency_pending` is not among the errors, and is one warning naming tracking:REQ-002 and contracts:REQ-002
