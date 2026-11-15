# Delta — agent-integration

## ADDED Requirements

### Requirement: REQ-549 — The loop installs as Agent Skills

The system SHALL, with `specgate agents init --format skills [--tool <name>]`, write one folder per step of the loop that `agents init` writes as commands (`specgate-explore`, `specgate-propose`, `specgate-apply`, `specgate-check`, `specgate-archive`, …), each with a `SKILL.md` whose front matter has the `name` of its folder and a `description` naming when to use it, into `.agents/skills/` and, for each tool named with `--tool` or, with none named, each tool whose folder the project has, its own skill folder (`.claude/skills/`, `.cursor/skills/`, `.gemini/skills/`); and SHALL leave a folder untouched when its `SKILL.md` was changed by hand, reporting `skill_kept`.

#### Scenario: SCN-549a — Skills for Cursor

- GIVEN a specgate project
- WHEN a tool runs `specgate agents init --format skills --tool cursor`
- THEN `.agents/skills/specgate-apply/SKILL.md` and `.cursor/skills/specgate-apply/SKILL.md` exist, each with `name: specgate-apply` in its front matter

<!-- specgate:trace status=Implemented actor=Developer kind=functional -->

### Requirement: REQ-550 — The package carries the plugin manifests

The system SHALL keep, in the plugin folder `packages/claude-plugin` the marketplace entry points at, an Agent Plugins `plugin.json` and a Tessl `.tessl-plugin/plugin.json` next to the Claude Code manifest, and a `skills/` folder with the loop's skills, each manifest with the package's `name`, `version` and skill list, all generated from `package.json`; `npm run plugin:sync` SHALL regenerate them; and the test suite SHALL fail, naming each file, while the committed plugin differs from what the generator renders.

#### Scenario: SCN-550a — A version bumped in one place

- GIVEN the repository with `package.json` at a new version and the manifests at the old one
- WHEN a maintainer runs the test suite, then `npm run plugin:sync`
- THEN the suite fails naming each manifest that differs, and the sync writes the three manifests at the new version

<!-- specgate:trace status=Implemented actor=Developer kind=functional -->
