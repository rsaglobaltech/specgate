# ADR-0037 — See the harness work

## Status

Accepted — 2026-10-19 (change `live-view`, archived)

## Context

An unattended harness run is a black box until it ends: the console shows one
line per attempt, and a requirement that takes twenty minutes looks the same
as one that hangs. Building agentkit, a prototype board — a script per agent
writing JSON lines, and a page republished by hand — showed what people want
to see: which requirement runs, what the agent is doing now, which files it
touched, how its tests went. It also showed the cost of doing it outside the
tool: a wrapper per agent, and a page nobody else could open.

## Decision

1. **One line format, owned by Specgate.** `harness run` writes
   `.harness/events/<REQ>.jsonl` — `t`, `req`, `attempt`, `type`, and for a
   step `kind`, `target`, `result` — and hands the file to the agent as
   `AGENT_EVENTS_FILE` (with `AGENT_EVENTS_REQ`, `AGENT_EVENTS_ATTEMPT`). The
   names are tool-neutral so a plugin can read them without naming Specgate.
2. **Adapters, not agents.** Claude Code's stream becomes events through
   `specgate harness events --from claude` at the end of the agent's pipe;
   OpenCode's plugin (agentkit) writes the same lines; any agent may.
3. **Nothing sensitive in an event.** No file contents, no tool output, no
   environment values; commands are masked for token-like values.
4. **Studio shows it, locally.** `/live` reads the files and pushes changes by
   server-sent events. Studio binds to loopback and refuses foreign `Host`
   headers (DNS rebinding); `--host` opens it deliberately, e.g. in a
   devcontainer.
5. **Explore writes nothing; the tour touches nothing.** `explore` gives the
   agent the project's state and undoes any write; `onboard --tour` runs the
   loop on a temporary copy.

## Consequences

- A team sees a run without a wrapper script, on any agent that writes the
  format.
- The event files grow with a run; they are git-ignored and safe to delete.
- Studio is no longer reachable from another machine by default.

## Alternatives considered

- **A hosted dashboard.** Events would leave the machine; rejected for
  enterprise use.
- **Polling the git worktrees.** Shows files, not intent, and nothing about
  tests or attempts.
