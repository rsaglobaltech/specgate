# Proposal: update-agent-contract

## Intent

Found upgrading Specgate in a real project: `specgate update` said "Nothing to
update — this project has no generated agent files", and the `AGENTS.md` block
kept the previous template — without the ticket path an agent needed. A
project adopted without agent files never received a new contract.

## Scope

In scope: `specgate update` refreshes the `AGENTS.md` block, keeping its facts
and project rules (REQ-155).
