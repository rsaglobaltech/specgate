Feature: New ids skip the ranges open changes reserved

  @REQ-121 @SCN-121a
  Scenario: A requirement added while a change is open
    Given an open change that reserved REQ-002 to REQ-004, and no requirement above REQ-001 anywhere else
    When the developer runs `specgate new "Totals are rounded half-up"`
    Then the new requirement is REQ-005
