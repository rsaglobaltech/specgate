# Proposal: opencode-agent

## Intent

A company adopting Specgate drives its agent with OpenCode. `specgate agents init` wired ten tools but not OpenCode, so `/specgate-*` commands were missing there; OpenCode reads `AGENTS.md`, so only the commands were.

## Scope

In scope: OpenCode in `agents init` and its detection (REQ-162).
