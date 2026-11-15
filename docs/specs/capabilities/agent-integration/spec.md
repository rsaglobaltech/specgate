# Agent Integration

## Requirements

### Requirement: REQ-426 — The guards name the next requirement as the change's tasks order it

The guard's denial (REQ-421, REQ-422) and the session context (REQ-420) SHALL name as the next requirement of an open change the first requirement, not yet Implemented, that an unchecked line of the change's `tasks.md` names, in the file's order; requirements no unchecked line names SHALL follow in the order the deltas declare them. Without a `tasks.md`, the deltas' order SHALL apply. The denial SHALL say that a test, new or modified in the working tree, naming any requirement of the change unlocks the file.

> Session 2026-11-08, agentkit `module-map-v2`: `tasks.md` put REQ-320 next; the denial said "write the test for REQ-311 first".

#### Scenario: SCN-426a — The next requirement by the tasks

- GIVEN an open change `module-map-v2` whose delta declares REQ-311, REQ-312, REQ-313, REQ-319 and REQ-320, REQ-313 and REQ-319 Implemented, and whose `tasks.md` has "REQ-313" and "REQ-319" checked and then, unchecked, "REQ-320", "REQ-312", "REQ-311"
- WHEN the agent tries to write `src/core/map/scan.ts` with no test in the working tree naming a requirement of the change
- THEN the edit is denied with "write the test for REQ-320 first" and "a test that names any requirement of `module-map-v2`", and the session context says the next requirement is REQ-320

<!-- specgate:trace actor=Developer feature=features/agent-integration/REQ-426.feature kind=functional status=Implemented -->

### Requirement: REQ-427 — With every requirement applied, the guard names none

When every requirement of every open change is Implemented (or later), the guard's denial SHALL name no requirement: it SHALL say that the change is ready for its reviewer and `specgate archive <change-id>` once they agree, or `specgate propose <change-id>` for new work.

#### Scenario: SCN-427a — Nothing left to apply

- GIVEN an open change `module-map` whose requirements are all Implemented
- WHEN the agent tries to write `src/core/map/scan.ts`
- THEN the edit is denied with "every requirement of `module-map` is applied" and the two commands, and no REQ id

<!-- specgate:trace actor=Developer feature=features/agent-integration/REQ-427.feature kind=functional status=Implemented -->

### Requirement: REQ-549 — The loop installs as Agent Skills

The system SHALL, with `specgate agents init --format skills [--tool <name>]`, write one folder per step of the loop that `agents init` writes as commands (`specgate-explore`, `specgate-propose`, `specgate-apply`, `specgate-check`, `specgate-archive`, …), each with a `SKILL.md` whose front matter has the `name` of its folder and a `description` naming when to use it, into `.agents/skills/` and, for each tool named with `--tool` or, with none named, each tool whose folder the project has, its own skill folder (`.claude/skills/`, `.cursor/skills/`, `.gemini/skills/`); and SHALL leave a folder untouched when its `SKILL.md` was changed by hand, reporting `skill_kept`.

#### Scenario: SCN-549a — Skills for Cursor

- GIVEN a specgate project
- WHEN a tool runs `specgate agents init --format skills --tool cursor`
- THEN `.agents/skills/specgate-apply/SKILL.md` and `.cursor/skills/specgate-apply/SKILL.md` exist, each with `name: specgate-apply` in its front matter

<!-- specgate:trace actor=Developer feature=features/agent-integration/REQ-549.feature kind=functional status=Implemented -->

### Requirement: REQ-550 — The package carries the plugin manifests

The system SHALL keep, in the plugin folder `packages/claude-plugin` the marketplace entry points at, an Agent Plugins `plugin.json` and a Tessl `.tessl-plugin/plugin.json` next to the Claude Code manifest, and a `skills/` folder with the loop's skills, each manifest with the package's `version`, its author and its repository, all generated from `package.json`; each manifest SHALL be valid against its own format: the Agent Plugins one carries the 1.0.0 `$schema`, the name `specgate` and no key that schema does not define, its skills found in `skills/`, and the Tessl one names the plugin `rsaglobaltech/specgate` and points `skills` at `./skills/` and `mcpServers` at a `.mcp.json` whose server states its `type`; `npm run plugin:sync` SHALL regenerate them; and the test suite SHALL fail, naming each file, while the committed plugin differs from what the generator renders or a manifest breaks its format's rules.

#### Scenario: SCN-550a — A version bumped in one place

- GIVEN the repository with `package.json` at a new version and the manifests at the old one
- WHEN a maintainer runs the test suite, then `npm run plugin:sync`
- THEN the suite fails naming each manifest that differs, and the sync writes the three manifests at the new version

#### Scenario: SCN-550b — A manifest a registry would refuse

- GIVEN the Agent Plugins manifest with a `skills` key, or the Tessl manifest named `specgate`
- WHEN a maintainer runs the test suite
- THEN it fails naming the manifest and the rule: a key the Agent Plugins schema does not define, or a Tessl name without its workspace

<!-- specgate:trace actor=Developer feature=features/agent-integration/REQ-550.feature kind=functional status=Implemented -->
