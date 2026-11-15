# Proposal: alm-phases

## Intent

Item 4 of the 1.0 line (`docs/specs/enterprise-sdd-gap.md`): the board follows the spec's
phases. The article asks for the backlog issue to track the spec as it moves — proposed, being built,
archived — and for what product writes on the ticket to reach the change, without product adopting Git.
Today `alm sync` only creates and closes mirror issues, and with the ticket as source the board is moved by
Jira Automation from branches, not by Specgate. The spec stays the contract (ADR-0021): the board reflects
a phase, and a ticket's new words come back as notes for a person to fold in, never as a rewrite.

## Scope

- `phases:` in `alm.config.yaml`, defaults per provider; `alm sync` moves each change's ticket (REQ-305).
- `alm pull` brings new comments and a changed description back as notes (REQ-306).
- `repositories:` in `change.yaml` gives one sub-issue per repository (REQ-307), for the workspace.
- Linear, a fourth built-in provider (REQ-308).
- `alm phase` and `alm move`, also as MCP tools (REQ-309).

New provider capabilities (`phase`, `subIssues`, `comments`, `readText`) are optional: a community provider
written for 0.27 still passes the declaration check and degrades with a message.
