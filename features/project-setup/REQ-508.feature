Feature: config set writes quality checks and ALM settings, never a credential

  @REQ-508 @SCN-508a
  Scenario: A check, the Jira settings and a token refused
    Given a project with `harness.config.yaml`
    When a tool runs `specgate config set checks.lint.run "npm run lint"`, `config set checks.lint.when end`, `config set alm.provider jira` and `config set alm.token_env JIRA_TOKEN`, then `config set alm.token_env "ATATT3xFfGF0abc=123" --json` and `config set checks.lint.when later --json`
    Then `specgate quality list --json` shows the check `lint` at `end`, `alm.config.yaml` has `provider: jira` and `token_env: JIRA_TOKEN`, and the last two exit 2 with `config_value_invalid` and a fix, the first saying to name the variable that holds the token, with both files unchanged
