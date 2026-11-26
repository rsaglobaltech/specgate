# Delta — agent-integration

## ADDED Requirements

### Requirement: REQ-790 — The plugin's hooks run as CommonJS in any project

<!-- specgate:trace actor=Developer kind=functional -->

The system SHALL write, with the Claude Code plugin's hook scripts, a `scripts/package.json` that declares them CommonJS, so that the guard refuses as it should in a project whose package.json says `"type": "module"`.

> Found on 2026-11-26: in such a project every hook failed to load, exited 1, and Claude Code took that as "do not block".

#### Scenario: SCN-790a — A module project

- GIVEN a project whose package.json says `"type": "module"`, and `agents init --tool claude-plugin`
- WHEN the plugin's guard is asked to write `src/x.js` with no change open
- THEN it refuses, exit 2, saying no change is open

### Requirement: REQ-791 — A first pack is not rendered over a project's own specification

<!-- specgate:trace actor=Developer kind=functional -->

The system SHALL refuse `specgate specops add` (and `expand`), writing nothing, when the project has no `.specops.lock` and already has capability specs with requirements or archived changes, naming what it found and offering `--force`.

> Found on 2026-11-26: a walkthrough's `specops add` replaced a real repository's spec.md, catalogs and 27 capability specs, and the gate stayed green.

#### Scenario: SCN-791a — A project with its own specification

- GIVEN a project with a capability spec holding REQ-012 and no `.specops.lock`
- WHEN the developer runs `specgate specops add` for a pack
- THEN it fails saying the project already has its own specification, and spec.md is as it was

### Requirement: REQ-792 — The MCP config tools declare and pass their key and value

<!-- specgate:trace actor=Developer kind=functional -->

The system SHALL declare, in the MCP tools for `config set`, `config get` and `config unset`, their `key` (and `value`), and pass the declared arguments to the CLI in the schema's order whatever order the client sent them in; switching the guard off SHALL stay refused.

#### Scenario: SCN-792a — Key and value

- GIVEN a project
- WHEN an MCP client calls `specgate_config_set` with `value: "on"` then `key: "pet"`, and with `agent_guard` `off`
- THEN `pet` is on, and the guard is still on
