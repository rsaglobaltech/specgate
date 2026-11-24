# Discover: opencode-plugin-v2

> Owner: product — what the business needs and why. No technology here: the
> design says how.

## Context

A team on OpenCode 2 installs Specgate's plugin and gets nothing: OpenCode
refuses to load it, in its log and nowhere else. Measured on 2026-11-24 with
OpenCode 2.3.2 — the exam's three runs at L3 left no trace of the plugin, and
the log said "Plugin must export a default definition with an id and an effect
or setup function". What the plugin is for — the open change in the session,
the test before the code, the gate when the agent stops — never happened there.

While measuring, the exam also ran OpenCode with the Developer's own
configuration: their MCP servers, one with a key, were at the hand of the model
under exam.

## Use case

1. The Developer runs `specgate agents init --tool opencode-plugin` in a project.
2. OpenCode 2 loads the plugin: the session knows the open change, a write to source code before its test is refused, and the gate speaks when the agent stops.
3. The Developer runs the compatibility exam; OpenCode works there with a configuration of its own.

## Acceptance criteria

- AC-1: the plugin Specgate writes loads in OpenCode 2, and a plugin left by an earlier Specgate is taken away.
- AC-2: in OpenCode 2 the plugin does its three jobs: the session's context, the test before the code, the gate at the end — once per message.
- AC-3: an exam run of OpenCode sees none of the Developer's own OpenCode configuration.
