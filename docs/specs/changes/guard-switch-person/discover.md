# Discover: guard-switch-person

> Owner: product — what the business needs and why. No technology here: the
> design says how.

## Context

The documentation review of 2026-11-26 found a road around the guard. An agent
connected through Specgate's MCP server can call the tool that sets a
setting, and that tool passes any text it is given to the CLI: `agent_guard
off` switches the guard off. The guard refuses that command in the agent's
shell, but an MCP call is not a shell command, and `config set` itself takes
anyone's word. The outside judge sees the switch afterwards; in the session
nothing stops it.

## Use case

1. A person switches the guard off at their own terminal, as before.
2. An agent asks for the same through any road — shell, MCP — and is refused,
   told the act is a person's.
3. An MCP tool passes to the CLI only the arguments it declares.

## Acceptance criteria

- AC-1: `config set agent_guard off` with no terminal is refused, saying it is a person's act; at a terminal it works as before.
- AC-2: an MCP tool passes to the CLI only the arguments its schema declares; anything else is not passed.
