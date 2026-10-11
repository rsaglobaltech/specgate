Feature: A tampered device clock

  @REQ-704 @SCN-705
  Scenario: A tampered device clock
    Given a worker who clocked in offline at 07:02 by the monotonic clock
    When the punch is synced at 09:15 with the device clock set to 06:30
    Then the punch is stored at 07:02 with the flag CLOCK_TAMPERED
