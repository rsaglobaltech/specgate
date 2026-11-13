# Proposal: agent-skills

## Intent

AIUP ships as skills in the open Agent Skills format (`SKILL.md`), installable
from Claude Code's plugin marketplace, from Tessl, or by copying a folder that
Codex, Cursor, Gemini CLI and OpenCode all scan. `specgate agents init`
writes slash commands per tool, in each tool's own format, so every new tool
needs code in specgate, and specgate is absent from the registries where teams
look for skills.

## Scope

In scope:

- REQ-549: `specgate agents init --format skills` writes the loop as Agent
  Skills folders into the skill directories each tool scans.
- REQ-550: the package carries the Agent Plugins and Tessl manifests, kept in
  step with the package version by a test.

Out of scope:

- Publishing to the registries: a release step, not a requirement.

## Approach

The skill bodies are the thin commands `agents init` already writes, wrapped
with the `SKILL.md` front matter (name, description with trigger phrases).
Manifests are generated from `package.json` at build time, so they cannot
drift.
