@change:codex-guard
Feature: Codex runs Specgate's guards

  @REQ-751 @SCN-751a
  Scenario: The hooks are written
    Given a spec-driven project with no `.codex/hooks.json`
    When the Developer runs `specgate agents init --tool codex-hooks`
    Then `.codex/hooks.json` runs the session hook on SessionStart, the guard on PreToolUse for `Bash|apply_patch`, and the gate on Stop, and the scripts are under `.codex/specgate/`

  @REQ-751 @SCN-751b
  Scenario: A patch to source code before its test
    Given change draft-fees open with REQ-002 and no test that names it
    When Codex asks to apply a patch that adds `src/fees.js`
    Then the guard refuses it, exit code 2, saying to write the test for REQ-002 first

  @REQ-751 @SCN-751c
  Scenario: Hooks a person wrote are kept
    Given a `.codex/hooks.json` a person wrote
    When `specgate agents init --tool codex-hooks --force` runs
    Then the file is as it was, and the command says it was kept
