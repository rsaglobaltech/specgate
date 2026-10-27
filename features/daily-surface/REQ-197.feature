Feature: Opening a module says which drafts stop growing

  @REQ-197 @SCN-197a
  Scenario: Opening the second module warns about the first
    Given draft-bookings is open and unwritten
    When `specgate draft coupons` opens a draft
    Then its status has draft_other_unwritten naming draft-bookings, with `--reserve` in its fix
