# Design: config-agents

> Owner: architect — how the system meets the Discover. Name each acceptance
> criterion (AC-1, AC-2…) where it is answered.

## Modules

- `scripts/lib/config-keys.ts` — the keys `profiles.<name>.match.module`,
  `profiles.<name>.match.requirement`, `sandbox.engine`, `sandbox.kit`,
  `sandbox.allow`, `sandbox.setup`, `sandbox.image`, `sandbox.network`; the
  removal.
- The `config` command — `config unset <key>`.

## Mechanisms

- AC-1 — `config set profiles.<name>.match.module <capability>` writes
  `profiles: { <name>: { match: { module: … } } }` in .harness/profiles.yaml;
  `.match.requirement <REQ-NNN>` likewise. A module that the project does not
  have is refused, naming the ones it has.
- AC-2 — `config set sandbox.<field> <value>` writes the `sandbox:` block of
  harness.config.yaml; `allow` takes a comma-separated list. The block is read
  back as the harness reads it (`readSandbox`): a value the harness would
  refuse is not written.
- AC-3 — `config unset <key>` removes the key; `config unset profiles.<name>`
  removes the profile; `config unset sandbox` the whole block. A key that is
  not set is not an error.

## Channels

None: the CLI and files. The studio's Settings › Agents uses these commands.

## Decisions

The studio writes nothing itself: every change goes through `config set` and
`config unset`, so the CLI and the studio check the same rules.
