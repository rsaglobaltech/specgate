Feature: The old names keep working

  @REQ-115 @SCN-115a
  Scenario: A script written for 0.20
    Given a CI script that runs `specgate change new add-dynamic-pricing` and later `specgate done REQ-002`
    When it runs against this version
    Then both commands succeed as `propose` and `apply` would
    And `specgate change archive --help` starts with "Same as specgate archive"
