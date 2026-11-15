Feature: No agent, a failing agent and an empty plan are answers

  @REQ-526 @SCN-526a
  Scenario: Not set, failing, and nothing to change
    Given a git project with no agent configured
    When a tool runs `specgate agent ask "…" --json`, then with `--agent` a script that writes "rate limited" to standard error and exits 1, then with `--agent` a script that changes nothing
    Then the first is refused with `agent_not_set` and the fix `specgate agents init --tool claude`; the second with `agent_failed` whose message holds "rate limited", and no plan is kept; the third exits 0 with `plan.id` null, `plan.files` empty and `plan_empty`
