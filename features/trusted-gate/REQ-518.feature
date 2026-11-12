Feature: The architecture check and the tests run side by side

  @REQ-518 @SCN-518a
  Scenario: Two stages of one second each
    Given a project whose `arch_cmd` and `test_cmd` each wait one second, print a line and pass
    When a tool runs `specgate check --json`, then sets `gate_parallel: false` and runs it again
    Then the first answer's architecture and tests stages both passed and overlapped in time; the second's ran one after the other
