# Design: gate-policy

> Owner: architect — how the system meets the Discover.

## Modules

`scripts/lib/gate-policy.ts` (new: reading, presets, levels, the template),
`scripts/cli/commands/quality/ValidateSpecsCommand.ts`,
`scripts/cli/commands/quality/CheckCommand.ts`, `scripts/lib/config-keys.ts`,
`scripts/cli/commands/project/gate.ts`.

## Mechanisms

- AC-1 — `.specgate/gate.yaml`: `preset`, `rules.<rule>`, `enforce_from`.
  Rules: `tdd`, `scenarios`, `requirements`, `links`, `coverage` (the
  families of `validate --strict`), `ids` and `quality` (stages of `check`).
  Presets: `strict` every rule error; `standard` coverage warning; `minimal`
  tdd, scenarios, links error, requirements, ids, quality warning, coverage
  off. `parseGatePolicy` lists every problem with its fix; `validate --strict`
  fails with `gate_policy_invalid`.
- AC-2 — `--strict` reads the policy. Each family's findings go through
  `reportOnly(rule)`: under `warning` they join the verdict's notes as
  warnings plus one `gate_rule_reported`, and the family returns instead of
  exiting. `off` is the family not run. `--strict-<rule>` forces error.
  `check` re-reads validate's findings on a pass when the policy relaxes a
  rule, says each `gate_rule_reported` under the stage, and carries them in
  `status`; `ids` and `quality` are judged the same way in `check` itself.
- AC-3 — `levelOf` turns `error` into `warning` while today is before
  `enforce_from`; `SPECGATE_TODAY` fixes today in tests.
- AC-4 — no file: `readGatePolicy` answers `strict`, source `default`.
- AC-5 — `gate.preset`, `gate.rules.<rule>`, `gate.enforce_from` in the
  config catalog, file `.specgate/gate.yaml`; the written text is read back
  with `parseGatePolicy` before it replaces the file. `installGate` (init and
  adopt) writes the standard template when no policy exists, `--no-ci`
  included.

## Channels

`check` prints `Policy` under its header when the file exists. `config keys
--json` lists the keys. Docs: `docs/gate/policy.md`.

## Decisions

- `--strict` keeps meaning "the gate"; the gate is now the policy. The
  individual flags keep their meaning, so a CI invocation written before
  this change still means what it meant.
- Branches, waivers, native CI reporting and the brief in the gate are the
  later slices of #494.
