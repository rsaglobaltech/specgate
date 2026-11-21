# Delta — harness

## ADDED Requirements

### Requirement: REQ-616 — The drafting commands give Claude Code its flags in Claude's own command, not after a pipe

<!-- specgate:trace status=Implemented feature=features/harness/REQ-616.feature actor=Developer kind=functional -->

The system SHALL, when a drafting command (`propose --from-brief --agent`, `draft <module> --agent`, and every other command that runs the agent confined to the change) adds `--permission-mode acceptEdits` or `--add-dir "<dir>"` to a Claude Code print-mode command, insert each flag right after `claude`, so that it reaches Claude Code also when the command pipes its output — as the command `harness init` writes, `claude … -p < {prompt_file} | specgate harness events --from claude`, does; and SHALL leave a command that already sets the flag as it is.

> Studio report (#530): on a project whose agent is the piped command specgate writes when Claude Code is detected, `propose --from-brief --brief <file outside the project> --agent …` failed every time with `draft_no_front_matter`: `--add-dir` was appended after the pipe, so it went to `specgate harness events` and Claude Code could not write the brief.

#### Scenario: SCN-616a — The piped agent proposes the front matter of a brief outside the project

- GIVEN the agent `claude --output-format stream-json --verbose --permission-mode acceptEdits -p < {prompt_file} | specgate harness events --from claude` and a brief in a folder outside the project
- WHEN the Developer runs `specgate propose --from-brief --brief <that file> --agent <that command>`
- THEN the command run is `claude --add-dir "<that folder>" --output-format stream-json --verbose --permission-mode acceptEdits -p < {prompt_file} | specgate harness events --from claude`, and `specgate harness events` gets no flag of Claude's

#### Scenario: SCN-616b — Edit permission for a piped agent without one

- GIVEN the agent `claude -p < {prompt_file} | specgate harness events --from claude`
- WHEN a drafting command runs it
- THEN the command run is `claude --permission-mode acceptEdits -p < {prompt_file} | specgate harness events --from claude`
