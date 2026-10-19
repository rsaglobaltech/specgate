Feature: The harness installs dependencies without being told

  @REQ-123 @SCN-123a
  Scenario: A Node project with a lockfile
    Given a project with `package-lock.json` and no `setup_cmd` in harness.config.yaml
    When the developer runs `specgate harness run --dry-run`
    Then the plan names `npm ci --silent --no-audit --no-fund` as the setup step of each worktree
    And with `--setup-cmd none` it names no setup step
