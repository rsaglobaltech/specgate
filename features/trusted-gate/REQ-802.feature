Feature: A slow delivery names the faster command

  @REQ-802 @SCN-802a
  Scenario: The whole suite, slowly
    Given `test_cmd` is `node slow.js`, which takes longer than the limit, and no `test_cmd_affected`
    When the Developer runs `specgate apply REQ-001`
    Then REQ-001 is Implemented, and the output names `specgate config set test_cmd_affected "node slow.js {files}"` and `docs/fast-gate.md`

  @REQ-802 @SCN-802b
  Scenario: Already scoped
    Given the same slow command, as `test_cmd_affected` with `{files}`
    When the Developer runs `specgate apply REQ-001`
    Then the output does not name `test_cmd_affected`
