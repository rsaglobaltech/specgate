Feature: apply runs the plan's checks and says what they found

  @REQ-525 @SCN-525a
  Scenario: validate runs, a shell command does not
    Given an agent that asks for `specgate validate` and `rm -rf src` after its edit
    When a tool runs `specgate agent ask "…" --json`, then `specgate agent apply <id> --json`
    Then the plan's `then` is `specgate validate` alone and its `status` has `then_refused` naming `rm -rf src`; `applied.then` has `specgate validate` with its exit and findings, and `src` is still there
