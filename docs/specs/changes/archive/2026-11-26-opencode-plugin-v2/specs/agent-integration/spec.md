# Delta — agent-integration

## ADDED Requirements

### Requirement: REQ-727 — The OpenCode plugin loads in OpenCode 2

<!-- specgate:trace status=Implemented feature=features/agent-integration/REQ-727.feature actor=Developer kind=functional -->

The system SHALL, on `specgate agents init --tool opencode-plugin`, write the plugin as `.opencode/plugins/specgate/index.js` whose default export is an OpenCode 2 definition with the id `specgate` and a setup function, and remove a `.opencode/plugin/specgate.js` that an earlier Specgate generated, leaving a file of that name written by hand.

> Measured on 2026-11-24: OpenCode 2.3.2 refused the generated plugin — "Plugin must export a default definition with an id and an effect or setup function" — and said so only in its log.

#### Scenario: SCN-727a — The definition OpenCode 2 loads

- GIVEN a project with no OpenCode plugin
- WHEN the Developer runs `specgate agents init --tool opencode-plugin`
- THEN `.opencode/plugins/specgate/index.js` exists, imports `Plugin` from `@opencode/plugin`, and default-exports `Plugin.define` with the id `specgate` and a setup function

#### Scenario: SCN-727b — The old plugin taken away

- GIVEN a project with the `.opencode/plugin/specgate.js` an earlier Specgate generated
- WHEN the Developer runs `specgate agents init --tool opencode-plugin`
- THEN that file is gone and the new one is written

### Requirement: REQ-728 — The plugin's three jobs on OpenCode 2's hooks

<!-- specgate:trace status=Implemented feature=features/agent-integration/REQ-728.feature actor=Developer kind=functional -->

The system SHALL, in OpenCode 2, add the open change and its next step to each model request's system text; refuse a `write`, an `edit` or a patch of a source file while no test names a requirement of the open change, with the step to take instead; and, when the agent stops, run the gate and send its findings into the session once per message of the Developer's — each decision recorded when SPECGATE_HOOK_LOG names a file.

> The plugin's purpose (REQ-422) on the hooks OpenCode 2 has: context, tool execute.before, prompt, and the event session.execution.succeeded.

#### Scenario: SCN-728a — Code before its test is refused

- GIVEN REQ-002 pending with no test that names it
- WHEN OpenCode 2 is about to run `write` on src/fees.js
- THEN the plugin refuses it naming REQ-002, and the hook log has a refusal for src/fees.js

#### Scenario: SCN-728b — The gate speaks once

- GIVEN a session whose agent stopped with a failing gate
- WHEN `session.execution.succeeded` arrives twice for the same message
- THEN the findings are sent into the session once

#### Scenario: SCN-728c — The session knows the change

- GIVEN a project with the change draft-fees open
- WHEN OpenCode 2 builds a model request
- THEN the system text gains one part that names draft-fees

### Requirement: REQ-729 — The exam runs OpenCode with a configuration of its own

<!-- specgate:trace status=Implemented feature=features/agent-integration/REQ-729.feature actor=Developer kind=functional -->

The system SHALL start OpenCode, in an exam run, with its configuration folder set to a folder of that run, so that the Developer's own OpenCode servers, keys, plugins and commands are not there for the model under exam.

> Found on 2026-11-24: the exam's OpenCode runs had the Developer's MCP servers, one with a key in its configuration.

#### Scenario: SCN-729a — Nothing of the Developer's

- GIVEN XDG_CONFIG_HOME pointing at a folder with an opencode.json of the Developer's
- WHEN the Developer runs `specgate compat run --tool opencode --level L0 --runs 1`
- THEN OpenCode was started with XDG_CONFIG_HOME inside the run's own folder
