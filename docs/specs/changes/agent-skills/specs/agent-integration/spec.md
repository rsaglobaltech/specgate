# Delta — agent-integration

## ADDED Requirements

### Requirement: REQ-549 — The loop installs as Agent Skills

The system SHALL, with `specgate agents init --format skills [--tool <name>]`, write one folder per specgate command of the loop — propose, apply, check, status, archive, questions — each with a `SKILL.md` whose front matter has the `name` of its folder and a `description` naming when to use it, into `.agents/skills/` and, for the tool named or detected, its own skill folder (`.claude/skills/`, `.cursor/skills/`, `.gemini/skills/`); and SHALL leave a folder untouched when its `SKILL.md` was changed by hand, reporting `skill_kept`.

#### Scenario: SCN-549a — Skills for Cursor

- GIVEN a specgate project
- WHEN a tool runs `specgate agents init --format skills --tool cursor`
- THEN `.agents/skills/specgate-apply/SKILL.md` and `.cursor/skills/specgate-apply/SKILL.md` exist, each with `name: specgate-apply` in its front matter

<!-- specgate:trace status=Draft actor=Developer kind=functional -->

### Requirement: REQ-550 — The package carries the plugin manifests

The system SHALL ship, in the published package, an Agent Plugins `plugin.json` and a Tessl `.tessl-plugin/plugin.json` next to the Claude Code manifest in `packages/claude-plugin`, each with the package's `name`, `version` and skill list; and the build SHALL fail when a manifest's version differs from `package.json`'s.

#### Scenario: SCN-550a — A version bumped in one place

- GIVEN the repository with `package.json` at a new version and the manifests at the old one
- WHEN a maintainer runs the build
- THEN it regenerates the three manifests at the new version, or fails naming the manifest that differs

<!-- specgate:trace status=Draft actor=Developer kind=functional -->
