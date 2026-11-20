Feature: The agent can run the project's test command

  @REQ-614 @SCN-614a
  Scenario: The documented command and a two-part test command
    Given the agent `claude -p < {prompt_file}` and the test command `npm test && npm run build`
    When the developer runs `specgate harness run`
    Then the agent runs as `claude --permission-mode acceptEdits --allowedTools "Bash(npm test:*)" "Bash(npm run build:*)" -p < {prompt_file}`, and the run says `Claude Code may run the test command and no other`

  @REQ-614 @SCN-614b
  Scenario: Permissions the person chose
    Given an agent command that says `--allowedTools Read Write`, one that says `--dangerously-skip-permissions`, one for another tool, and one with no test command known
    When the test permission is worked out for each
    Then each command is unchanged

  @REQ-614 @SCN-614c
  Scenario: A part a rule cannot carry
    Given the test command `mvn -B test && sh -c "echo $HOME" ; npx cucumber-js --tags {req}`
    When the test permission is worked out
    Then only `mvn -B test` is allowed

  @REQ-614 @SCN-614d
  Scenario: The prompt names the command
    Given a project whose test command is `mvn -B test`
    When the developer runs `specgate harness run --dry-run`
    Then the prompt says to run the tests with `mvn -B test` and to see the new test fail first
