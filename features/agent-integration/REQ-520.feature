Feature: agent ask proposes a plan and writes nothing

  @REQ-520 @SCN-520a
  Scenario: An agent proposes a line in spec.md
    Given a git project whose `harness.config.yaml` sets `agent:` to a script that adds a line to `spec.md`, says why and that `specgate validate` follows, and prints its usage as Claude Code does
    When a tool runs `specgate agent ask "allow cancelling up to 24 h before shipping" --plan --json`
    Then it exits 0; `plan.files` is `spec.md`, `modify`, with the agent's reason and a diff that adds the line; `plan.then` is `specgate validate`; `plan.usage` has the tokens and the cost; and `spec.md` in the project is unchanged
