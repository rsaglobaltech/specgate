Feature: An open draft can reserve more ids while its range is the last

  @REQ-177 @SCN-177a
  Scenario: The last draft grows
    Given a project whose only open draft, draft-bookings, holds REQ-001…REQ-010 and SCN-001…SCN-030
    When the developer runs `specgate propose --from-brief bookings --reserve 15`
    Then change.yaml holds REQ-001…REQ-015 and SCN-001…SCN-045, DRAFTING.md names REQ-015, and the next draft opened starts at REQ-016

  @REQ-177 @SCN-177b
  Scenario: A draft followed by another cannot grow
    Given draft-bookings holds REQ-001…REQ-010 and draft-coupons was opened after it
    When the developer runs `specgate propose --from-brief bookings --reserve 15`
    Then the command exits 1 with draft_range_not_last naming REQ-011, and change.yaml is unchanged

  @REQ-177 @SCN-177c
  Scenario: Asking for fewer than it holds
    Given draft-bookings holds ten ids
    When the developer runs `specgate propose --from-brief bookings --reserve 5`
    Then the command exits 1 saying it already holds 10, and change.yaml is unchanged
