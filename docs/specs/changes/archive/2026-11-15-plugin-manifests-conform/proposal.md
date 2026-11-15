# Proposal: plugin-manifests-conform

## Intent

The Agent Plugins and Tessl manifests REQ-550 shipped were written to a generic
shape, not checked against either format. Against the published formats, both
fail: the Agent Plugins 1.0.0 schema requires `$schema` and admits no `skills`
key (it allows no keys beyond its own), and Tessl requires the name as
`<workspace>/<plugin>`. A registry would refuse the plugin.

## Scope

In scope:

- The Agent Plugins `plugin.json`: `$schema`, only the schema's keys, skills found in `skills/`.
- The Tessl `.tessl-plugin/plugin.json`: `rsaglobaltech/specgate`, `skills` and `mcpServers` as paths, no undocumented keys.
- Every manifest names its author and repository; the plugin's `.mcp.json` states its server's transport.

Out of scope:

- Publishing to either registry.

## Approach

REQ-550 is restated: each manifest valid against its own format, the test
suite checking the rules each format publishes.
