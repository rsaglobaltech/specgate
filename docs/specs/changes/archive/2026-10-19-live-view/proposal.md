# Proposal: live-view

## Intent

Milestone M4 — delight. Building agentkit, the team wanted to see what the
harness and its agent were doing while they worked. A prototype board proved
the shape but needed a wrapper per agent and a page republished by hand. Two
more gaps: a way to think with the agent before a change exists, and a way to
learn the loop on one's own repository without risking it.

Decision record: [ADR-0037](../../../adr/0037-see-the-harness-work.md).

## Scope

In scope:

- Harness events in `.harness/events/<REQ>.jsonl`, and `AGENT_EVENTS_FILE`,
  `AGENT_EVENTS_REQ`, `AGENT_EVENTS_ATTEMPT` for the agent (REQ-128) — the
  names agentkit's OpenCode plugin already reads.
- `specgate harness events --from claude`: Claude Code's stream as events
  (REQ-129), with no contents, output or secrets (REQ-130).
- `specgate studio`: `/live`, `/live.json`, `/live/stream` (REQ-131), bound to
  loopback and refusing foreign Host headers (REQ-132).
- `specgate explore` (REQ-133) and `specgate onboard --tour` (REQ-134).

Out of scope:

- Cost per attempt (agents report it differently); remote dashboards.

## Approach

One line format, written by the harness and by adapters alike. Studio reads
files; it never talks to an agent.
