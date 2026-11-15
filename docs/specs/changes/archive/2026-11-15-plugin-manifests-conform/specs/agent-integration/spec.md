# Delta — agent-integration

## MODIFIED Requirements

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

<!-- specgate:trace status=Implemented feature=features/agent-integration/REQ-550.feature actor=Developer kind=functional -->
