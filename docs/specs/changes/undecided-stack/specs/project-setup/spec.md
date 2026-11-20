# Delta — project-setup

## ADDED Requirements

### Requirement: REQ-607 — An undecided stack names the way to decide it

The system SHALL, when `adopt` finds no build manifest, state `Stack` and `Testing` in the header of `AGENTS.md` as `TBD`, and SHALL have the contract tell the agent to stop at a `TBD` and ask the person to run `specgate config set stack` or `specgate init --forja`; SHALL, on `specgate config set stack <value>` and `specgate config set testing <value>`, write the value into that header inside Specgate's block only, refusing with `config_value_invalid` a value that holds `·` or a line break; and SHALL, while either is `TBD` or the `unknown` an earlier version wrote, say so in `status` and as a warning in `doctor`, each with the command, and say nothing once both are decided.

#### Scenario: SCN-607a — Adopted with no code

- GIVEN an empty folder
- WHEN the developer runs `specgate adopt`, then `specgate status` and `specgate doctor`
- THEN `AGENTS.md` says `Stack: TBD` and `Testing: TBD` and names `specgate config set stack` and `specgate init --forja`, and both commands print `specgate config set stack "<yours>"`

#### Scenario: SCN-607b — The person decides

- GIVEN that project, with a line `Stack: do not touch this line` the team wrote below Specgate's block
- WHEN the developer runs `specgate config set stack "a · b"`, then `specgate config set stack Go` and `specgate config set testing "go test"`
- THEN the first exits 2 with `config_value_invalid`, the header says `Stack: Go` and `Testing: go test`, the team's line is as it was, and `status` and `doctor` no longer mention the stack

#### Scenario: SCN-607c — A stack read from the project

- GIVEN a folder with a `package.json`
- WHEN the developer runs `specgate adopt`
- THEN `AGENTS.md` states the stack it read, and `status` and `doctor` say nothing about deciding it

<!-- specgate:trace actor=Developer feature=features/project-setup/REQ-607.feature kind=functional status=Approved -->
