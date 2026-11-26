Feature: The bug's scenario is seen red before it is fixed

  @REQ-682 @SCN-682a
  Scenario: Red, kept
    Given REQ-090 of a bug change, and a `bdd_cmd` that fails for `@REQ-090`
    When the Developer runs `specgate reproduce run REQ-090`
    Then `.specgate/evidence/REQ-090/red.json` names the command with a non-zero exit code, and the output says the bug is reproduced

  @REQ-682 @SCN-682b
  Scenario: Green, refused
    Given REQ-090 of a bug change, and a `bdd_cmd` that passes for `@REQ-090`
    When the Developer runs `specgate reproduce run REQ-090`
    Then it refuses with `repro_not_red`, and no `red.json` is written
