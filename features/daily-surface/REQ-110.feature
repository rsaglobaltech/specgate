Feature: apply delivers one requirement: test first, gate, Implemented

  @REQ-110 @SCN-110a
  Scenario: No test yet
    Given pending REQ-002 and no test that mentions REQ-002
    When the developer runs `specgate apply REQ-002`
    Then the command exits 1 with code `apply_no_test`
    And the last line reads `fix: write a test that names REQ-002 (and its scenario SCN-002a), then run specgate apply REQ-002`

  @REQ-110 @SCN-110b
  Scenario: Green gate, Implemented
    Given pending REQ-002, a test that names REQ-002 and SCN-002a, and a test command that passes
    When the developer runs `specgate apply REQ-002`
    Then REQ-002's status is Implemented, the command exits 0, and its output ends with the next step naming the next pending requirement

  @REQ-110 @SCN-110c
  Scenario: Red gate, nothing written
    Given pending REQ-002, a test that names it, and a test command that fails
    When the developer runs `specgate apply REQ-002`
    Then the command exits 1, REQ-002's status is unchanged, and the last line is a `fix:` line naming the failing check

  @REQ-110 @SCN-110d
  Scenario: No id: the next one
    Given pending REQ-002 and REQ-003, REQ-002 first in `specgate status`
    When the developer runs `specgate apply`
    Then the command works on REQ-002 and says so in its first line
