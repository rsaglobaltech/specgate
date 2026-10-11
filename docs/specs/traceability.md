# Traceability Matrix — the Specgate CLI

> Links every CLI requirement to its scenario, feature file, implementation and
> test. All requirement IDs reference [`/spec.md`](../../spec.md).
>
> **This is the rich 10-column format the CLI generates for user projects** —
> the tool has to be able to operate on its own repository, and
> `specgate change archive` rewrites the table below. `tests/unit/docs-truth.test.ts`
> fails the build if any path named here stops existing.
>
> Columns the CLI's own domain does not use (`Use Case`, `Command/Query`,
> `Aggregate`, `Event`) carry `-`. Bounded contexts live in [`/spec.md`](../../spec.md) §7.
>
> **Supporting sections avoid 3-, 4- and 10-column pipe tables.** The matrix
> parser reads any table of that shape as matrix rows and takes its first column
> for Scenario IDs, which trips the duplicate-ID check. §2 is a 5-column table
> and coexists fine; §3 and §4 are lists because they would not.

---

## 1. Requirements

| Requirement | Scenario ID | Feature file | Use Case | Command/Query | Aggregate | Event | Technical artifact | Test artifact | Status |
|---|---|---|---|---|---|---|---|---|---|
| REQ-001 | SCN-001 | `features/cli/init.feature` | - | - | - | - | `scripts/init_project.ts` | `tests/cli.test.ts` | Verified |
| REQ-002 | SCN-002 | `features/cli/validate.feature` | - | - | - | - | `scripts/validate_specs.ts` | `tests/unit/validate-remedies.test.ts` | Verified |
| REQ-003 | SCN-003 | `features/cli/expand.feature` | - | - | - | - | `scripts/expand_domain_pack.ts` | `tests/unit/common.test.ts` | Verified |
| REQ-004 | SCN-004 | `features/pack/expand-parking.feature` | - | - | - | - | `scripts/cli/commands/pack/ExpandDomainPackCommand.ts` | `tests/unit/init-engine-parity.test.ts` | Verified |
| REQ-005 | SCN-005 | - | - | - | - | - | `templates/base/docs/specs/runtime-environments.md.tpl` | `tests/cli.test.ts` | Verified |
| REQ-006 | SCN-006 | - | - | - | - | - | `scripts/init_pack.ts` | `tests/unit/pack-commands.test.ts` | Verified |
| REQ-007 | SCN-007 | - | - | - | - | - | `scripts/lint_pack.ts` | `tests/unit/pack-lint-quality.test.ts` | Verified |
| REQ-008 | SCN-008 | - | - | - | - | - | `actions/spec-driven-action/action.yml` | TBD | Draft |
| REQ-009 | SCN-009 | - | - | - | - | - | `scripts/init_project.ts` | `tests/snapshot/init-determinism.test.ts` | Verified |
| REQ-010 | SCN-010 | - | - | - | - | - | `scripts/change/cli.ts` | `tests/unit/change-cli.test.ts` | Verified |
| REQ-011 | SCN-011 | - | - | - | - | - | `scripts/specops/sync.ts` | `tests/unit/specops-f1b.test.ts` | Verified |
| REQ-012 | SCN-012 | - | - | - | - | - | `scripts/harness/run.ts` | `tests/unit/harness-run.test.ts` | Verified |
| REQ-013 | SCN-013 | - | - | - | - | - | `scripts/adopt_project.ts` | `tests/unit/adopt.test.ts` | Verified |
| REQ-014 | SCN-014 | - | - | - | - | - | `scripts/doctor.ts` | `tests/unit/doctor.test.ts` | Verified |
| REQ-015 | SCN-015 | - | - | - | - | - | `scripts/req.ts` | `tests/unit/req-commands.test.ts` | Verified |
| REQ-100 | SCN-100a | - | - | - | - | - | - | TBD | Draft |
| REQ-101 | SCN-101a | - | - | - | - | - | - | TBD | Draft |
| REQ-102 | SCN-102a | - | - | - | - | - | - | TBD | Draft |
| REQ-103 | SCN-103a | - | - | - | - | - | - | TBD | Draft |
| REQ-104 | SCN-104a | - | - | - | - | - | - | TBD | Draft |
| REQ-105 | SCN-105a | - | - | - | - | - | - | TBD | Draft |
| REQ-106 | SCN-106a | - | - | - | - | - | - | TBD | Draft |

**REQ-008 is the one row that is honest about being unfinished.** The composite
action in `actions/spec-driven-action/` is exercised by nothing — a broken step
would ship unnoticed. It stays `Draft` with a `TBD` test until C6-08 covers it,
which is exactly what `--strict-tdd` is designed to tolerate: an acknowledged
gap, not a hidden one.

---

## 2. Non-functional requirements

| NFR | Requirement | Quality attribute | Measured by | Status |
|---|---|---|---|---|
| NFR-001 | `init` to green `validate` ≤ 60 s on clean env | Performance | Not measured automatically; `npm run smoke:init` is manual and not run by CI | Draft |
| NFR-002 | Unit coverage ≥ 80 % lines / ≥ 70 % branches | Reliability | `c8 --check-coverage` in CI. **Today: 74.8 % lines · 71.1 % branches · 80.4 % functions**, gated at 74/70/80. Branches and functions meet the target; lines does not | In Dev |
| NFR-003 | Zero ESLint errors and zero Prettier diffs on `main` | Maintainability | CI `lint` job: `npm run typecheck && npm run lint && npm run format:check` | Verified |
| NFR-004 | CLI emits structured JSON for agents via `--json` | Usability | `change --json` and `plan --format json` only. Whole-surface coverage is C3-02 | In Dev |
| NFR-005 | Every shipped `pack.yaml` passes schema and lint checks in CI | Reliability | `npm run registry:build` lints every pack in `packs/` and exits 1 on failure | Verified |

> **NFR-003 changed meaning.** It used to promise "zero ShellCheck warnings".
> ADR-0008 removed every shell script from the CLI, so there is nothing for
> ShellCheck to lint but the demo recording scripts. Adding that step is C6-05.

---

## 3. Test inventory

- **`tests/cli.test.ts`** — E2E / integration, `node:test`. Covers REQ-001,
  REQ-005 and REQ-012: dispatch, dry-run, the runtime contract, harness CI mode.
- **`tests/unit/`** — unit, `node:test` via `scripts/run-tests.cjs`. Covers
  REQ-002, REQ-003, REQ-006, REQ-007 and REQ-010 through REQ-015.
- **`tests/snapshot/init-determinism.test.ts`** — snapshot, `node:test`. Covers REQ-009.
- **`features/cli/` and `features/pack/`** — BDD, 22 Cucumber scenarios. Covers REQ-001 to REQ-004.
- **`packages/*/test/unit/`** — unit, `node:test`. VS Code extension, MCP server,
  pack registry and LSP server.
- **`tests/unit/docs-truth.test.ts`** — guard. Every path named in this file must exist.

---

## 4. Coverage gaps (open work)

- **P0 — REQ-008 has no test at all.** The composite action in
  `actions/spec-driven-action/` is exercised by nothing. _(C6-08)_
- **P0 — `--json` covers 2 commands of ~20.** _(C3-02)_
- **P1 — NFR-002 target not met.** Lines at 74.8 % against a target of 80 %. The
  gate is real, but ratcheted at 74. _(C6-01)_
- **P2 — NFR-001 is unmeasured.** No automated timing of `init` → green
  `validate`. _(C6-08)_
- **P2 — ShellCheck is not in CI**, though `CONTRIBUTING.md` used to claim it
  was. _(C6-05)_
