Feature: After adoption CI runs the test command the project saved

  @REQ-613 @SCN-613a
  Scenario: A build script
    Given a project whose `package.json` has `test` and `build` scripts
    When the developer runs `specgate adopt`
    Then it prints `Test command: npm test && npm run build`, `harness.config.yaml` holds that as `test_cmd`, `AGENTS.md` states it, and the job runs `check . --base` with no `--test-cmd`

  @REQ-613 @SCN-613b
  Scenario: No build script, and a command given
    Given a project with a `test` script only, and another with `test` and `build` adopted with `--var TEST_CMD="npm test"`
    When the developer runs `specgate adopt` in each
    Then both save `test_cmd: "npm test"`, and the first job has no `--test-cmd`

  @REQ-613 @SCN-613c
  Scenario: A CI file already there
    Given a project whose `.github/workflows/spec-gate.yml` says `# ours`
    When the developer runs `specgate adopt`
    Then the file still says `# ours`

  @REQ-613 @SCN-613d
  Scenario: The agent's commands
    Given a project with no agent folder
    When the developer runs `specgate adopt`
    Then it says `Agent commands: not installed` and not `Agent: none detected`
