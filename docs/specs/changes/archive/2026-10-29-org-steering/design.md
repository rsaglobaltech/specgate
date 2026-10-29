# Design: org-steering

> Owner: architect — how the system meets the Discover. Name each acceptance
> criterion (AC-1, AC-2…) where it is answered.

## Modules

- `packages/core/src/domain/Principles.ts` — pure: the principles file (front
  matter, principles, their machine checks) and version comparison.
- `packages/core/src/domain/ApiContract.ts` — pure: the operations of an
  OpenAPI or AsyncAPI document (YAML or JSON) and how a reference resolves.
- `scripts/lib/steering.ts` — reads the file, its source, runs the checks.
- `scripts/lib/drift.ts` — the commits since the base without a requirement.
- `scripts/lib/contracts.ts` — finds the contracts and the `api=` references.
- `scripts/cli/commands/spec/DriftCommand.ts`, `ContractCommand.ts` — the two
  new commands; `check`, `validate` and `adopt` gain the rest.

## Mechanisms

- AC-1 — `docs/specs/principles.md` carries `principles_version` and an optional
  `source` in its front matter: a path to the organization's copy (in a
  workspace, the workspace repository's) or `pack:<pack_id>`. `check` prints
  `Principles  <version>` and warns `principles_behind` when the source's
  version is higher (numeric comparison of dotted versions).
- AC-2 — a principle's machine check is a comment under its heading:
  `<!-- specgate:principle run="<command>" -->` (passes on exit 0) or
  `forbid="<regex>" in="<glob>"` (passes when no tracked file matching the glob
  contains it). A failure is the error `principle_failed`; `level=warn` makes it
  a warning.
- AC-3 — a domain pack already writes any file through `outputs.files`; a
  principles pack writes `docs/specs/principles.md`. With `source: pack:<id>`
  the version is compared with the pack's `metadata.version` in its local source
  folder, and the fix is `specgate specops sync`.
- AC-4 — `git rev-list <base>..HEAD`; a commit is drift when it changes a
  production file (a source extension outside test, spec, feature, docs and
  build-config paths), its message names no `REQ-NNN`, and none of the test
  files it changes names one. `check` warns `spec_drift`; `specgate drift`
  prints the same for CI.
- AC-5 — `drift: gate` in harness.config.yaml makes `spec_drift` an error.
- AC-6 — the `api=` trace attribute: `<file>#<JSON pointer>`, `<file>#<operationId>`
  or a bare operationId searched in the project's contracts; `validate` fails
  with `api_operation_missing` or `api_contract_missing`.
- AC-7 — `specgate contract check` lists, per contract, the operations no
  requirement cites (warnings) and the references that do not resolve (errors).
- AC-8 — `adopt --scope <path>` proposes capabilities only under that path,
  writes a baseline scenario naming it and records it in spec.md.
- AC-9 — adoption counts every area it found; more than the eight it proposes
  warns `adopt_too_big` with `adopt --scope <area>`.

## Channels

None between repositories: the source of the principles is a path or a pack.

## Decisions

No new ADR: principles reuse domain packs (ADR on packs) and the workspace
(ADR-0041) as their channels; the rest are checks of the existing gate.
