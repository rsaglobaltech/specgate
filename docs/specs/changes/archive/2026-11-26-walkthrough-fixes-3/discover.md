# Discover: walkthrough-fixes-3

> Owner: product — what the business needs and why. No technology here: the
> design says how.

## Context

The third literal walkthrough of the guides, on 2026-11-26, found three things
the product got wrong, two of them dangerous:

1. In a project whose package.json says `"type": "module"`, the Claude Code
   plugin's hooks failed to load; Claude Code takes a hook that fails as "do
   not block", so the guard let everything through, silently.
2. `specops add` rendered a pack over a project that already had its own
   specification — spec.md, the catalogs, the capability specs — and the gate
   stayed green. It happened to a real repository during the walkthrough.
3. The MCP tools that configure a project took no arguments since they pass
   only what they declare, so they could not set anything.

## Use case

The guard holds in any project; a pack is never rendered over work it did not
write unless asked; an agent over MCP can set a setting, never switch the guard
off.

## Acceptance criteria

- AC-1: the plugin's hooks run as CommonJS whatever the project's package.json says.
- AC-2: a first pack over a project with its own specification is refused, writing nothing, unless forced.
- AC-3: the MCP tools for `config set`, `get` and `unset` declare their key and value and pass them in that order.
