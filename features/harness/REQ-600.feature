Feature: Built in the brief's module order

  @REQ-600 @SCN-600a
  Scenario: Users before billing
    Given a brief listing the modules users, then billing; billing declares REQ-002 and users REQ-022
    When the person runs `specgate status`, then `specgate harness run --dry-run`
    Then REQ-022 comes before REQ-002 in both, and status says "users, the brief's 1st module of 2"
