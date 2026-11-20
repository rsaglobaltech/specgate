# Delta — harness

## ADDED Requirements

### Requirement: REQ-614 — The agent can run the project's test command

The system SHALL, when the agent command of `harness run` runs Claude Code in print mode with `--permission-mode acceptEdits` and names no tools of its own, add `--allowedTools` with one `Bash(<part>:*)` rule for each part of the test command, right after that flag, and say which parts it allowed; SHALL leave out a part that holds a quote, `$`, a pipe or a placeholder; SHALL leave a command that says `--allowedTools` or `--dangerously-skip-permissions` as written; and SHALL state in the prompt the parts of the test command to run, when a test command is known.

#### Scenario: SCN-614a — The documented command and a two-part test command

- GIVEN the agent `claude -p < {prompt_file}` and the test command `npm test && npm run build`
- WHEN the developer runs `specgate harness run`
- THEN the agent runs as `claude --permission-mode acceptEdits --allowedTools "Bash(npm test:*)" "Bash(npm run build:*)" -p < {prompt_file}`, and the run says `Claude Code may run the test command and no other`

#### Scenario: SCN-614b — Permissions the person chose

- GIVEN an agent command that says `--allowedTools Read Write`, one that says `--dangerously-skip-permissions`, one for another tool, and one with no test command known
- WHEN the test permission is worked out for each
- THEN each command is unchanged

#### Scenario: SCN-614c — A part a rule cannot carry

- GIVEN the test command `mvn -B test && sh -c "echo $HOME" ; npx cucumber-js --tags {req}`
- WHEN the test permission is worked out
- THEN only `mvn -B test` is allowed

#### Scenario: SCN-614d — The prompt names the command

- GIVEN a project whose test command is `mvn -B test`
- WHEN the developer runs `specgate harness run --dry-run`
- THEN the prompt says to run the tests with `mvn -B test` and to see the new test fail first

<!-- specgate:trace actor=Developer feature=features/harness/REQ-614.feature kind=functional status=Approved -->
