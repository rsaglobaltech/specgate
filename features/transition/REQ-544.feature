Feature: A user guide per actor

  @REQ-544 @SCN-544a
  Scenario: The customer's chapter
    Given REQ-001 `Implemented` for `Customer`, REQ-002 `Draft` for `Customer` and REQ-003 `Implemented` for `Clerk`
    When a tool runs `specgate guide --actor Customer`
    Then `docs/guide/customer.md` has a section for REQ-001 with its scenario as steps, and none for REQ-002 or REQ-003
