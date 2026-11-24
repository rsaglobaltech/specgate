Feature: A continued branch that holds the work is judged by the gate

  @REQ-708 @SCN-708a
  Scenario: The branch holds the work
    Given REQ-004's branch left by an earlier run with its test and code, and an agent that writes nothing
    When the Developer runs `specgate harness run --req REQ-004 --resume`
    Then the gate runs on the branch, and REQ-004 passes on harness/REQ-004

  @REQ-708 @SCN-708b
  Scenario: Nothing on the branch
    Given REQ-004's branch holding only the prompt archive of an earlier attempt, and an agent that writes nothing
    When the Developer runs `specgate harness run --req REQ-004 --resume`
    Then REQ-004 fails at the stage "no-op" and the gate does not run
