# Delta — trusted-gate

## ADDED Requirements

### Requirement: REQ-768 — Switching the guard off takes a person at a terminal

<!-- specgate:trace status=Implemented actor=Developer kind=functional -->

The system SHALL refuse `specgate config set agent_guard off` when its input is not a terminal and `SPECGATE_ASSUME_TTY` is not set, with `guard_needs_person`, saying switching the guard off is a person's act and writing nothing; and SHALL switch it as before at a terminal, and switch it on from anywhere.

> Found on 2026-11-26: the MCP tool that sets a setting passed `agent_guard off` to the CLI, a road the guard hook does not see.

#### Scenario: SCN-768a — An agent's call

- GIVEN a project with the guard on
- WHEN `specgate config set agent_guard off` runs with no terminal
- THEN it fails with `guard_needs_person`, and the guard is still on

#### Scenario: SCN-768b — A person at a terminal

- GIVEN the same project
- WHEN a person runs `specgate config set agent_guard off` at a terminal
- THEN the guard is off

### Requirement: REQ-769 — An MCP tool passes only the arguments it declares

<!-- specgate:trace status=Implemented actor=Developer kind=functional -->

The system SHALL, in the MCP server's tools that run the CLI, pass to the CLI only the arguments the tool's input schema declares, besides the project folder.

#### Scenario: SCN-769a — An undeclared argument

- GIVEN the MCP tool `specgate_config_set`, whose schema declares only the project folder
- WHEN it is called with `{ "projectDir": <dir>, "a": "agent_guard", "b": "off" }`
- THEN the CLI it runs is not given `agent_guard` or `off`, and the guard is still on
