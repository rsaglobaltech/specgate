Feature: A question on a requirement that waits does not block approving the rest

  @REQ-771 @SCN-771a
  Scenario: The rest goes ahead
    Given draft-bookings with REQ-002, REQ-003 and REQ-004, REQ-004 marked Needs Clarification and Q1, open, blocking REQ-004
    When a person runs `specgate change approve draft-bookings`
    Then the change is approved, `specgate apply REQ-002` can deliver REQ-002, and `specgate apply REQ-004` is refused with `done_needs_clarification`

  @REQ-771 @SCN-771b
  Scenario: A question on a decided requirement still blocks
    Given the same draft with Q2, open, blocking REQ-003, which is not marked Needs Clarification
    When a person runs `specgate change approve draft-bookings`
    Then it is refused with `approve_blocked`, naming Q2
