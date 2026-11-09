# Delta — harness

## ADDED Requirements

### Requirement: REQ-278 — The kept Claude Code agent is seen live

The system SHALL write, for `specgate config set agent` given a Claude Code print command that neither pipes its output nor sets an output format, the command streamed into the live view — `--output-format stream-json --verbose` after `claude`, and `| specgate harness events --from claude` at the end — and SHALL keep any other command as it is given.

#### Scenario: SCN-278a — The command status suggests

- GIVEN a project with no agent set
- WHEN the person runs `specgate config set agent "claude -p < {prompt_file}"`
- THEN `harness.config.yaml` says `agent: "claude --output-format stream-json --verbose --permission-mode acceptEdits -p < {prompt_file} | specgate harness events --from claude"`

#### Scenario: SCN-278b — A command that already streams or pipes

- GIVEN the commands `claude -p --output-format json < {prompt_file}` and `claude -p < {prompt_file} | tee agent.log`
- WHEN each is set as the agent
- THEN neither gets `stream-json` nor `specgate harness events`

<!-- specgate:trace status=Implemented test=tests/unit/agent-stream.test.ts actor=Developer kind=functional -->

## MODIFIED Requirements

### Requirement: REQ-271 — The agent is kept in harness.config.yaml

The system SHALL keep the agent command with `specgate config set agent "<command>"`, written to `harness.config.yaml` with the permission REQ-264 adds and, for Claude Code, the live stream REQ-278 adds; SHALL name the step in `status` while requirements are to do and no agent is set; and SHALL end a `harness run` given `--agent` on a project with none set with the command that keeps it.

#### Scenario: SCN-271a — Setting the agent once

- GIVEN a project with requirements to do and no `agent:` in `harness.config.yaml`
- WHEN the person runs `status`, then `specgate config set agent "claude -p < {prompt_file}"`
- THEN `status` named `specgate config set agent`, and `harness.config.yaml` keeps the agent with `--permission-mode acceptEdits`

<!-- specgate:trace actor=Developer feature=features/harness/REQ-271.feature kind=functional status=Implemented test=tests/unit/harness-run6.test.ts -->
