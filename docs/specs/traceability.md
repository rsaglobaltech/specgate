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
| REQ-107 | SCN-107a | `features/daily-surface/REQ-107.feature` | - | - | - | - | - | tests/unit/compact-use.test.ts | Implemented |
| REQ-108 | SCN-108a | `features/daily-surface/REQ-108.feature` | - | - | - | - | - | tests/unit/compact-use.test.ts | Implemented |
| REQ-109 | SCN-109a | `features/daily-surface/REQ-109.feature` | - | - | - | - | - | tests/unit/compact-use.test.ts | Implemented |
| REQ-110 | SCN-110a | `features/daily-surface/REQ-110.feature` | - | - | - | - | - | tests/unit/compact-use.test.ts | Implemented |
| REQ-111 | SCN-111a | `features/daily-surface/REQ-111.feature` | - | - | - | - | - | tests/unit/compact-use.test.ts | Implemented |
| REQ-112 | SCN-112a | `features/daily-surface/REQ-112.feature` | - | - | - | - | - | tests/unit/compact-use.test.ts | Implemented |
| REQ-113 | SCN-113a | `features/daily-surface/REQ-113.feature` | - | - | - | - | - | tests/unit/compact-use.test.ts | Implemented |
| REQ-114 | SCN-114a | `features/daily-surface/REQ-114.feature` | - | - | - | - | - | tests/unit/compact-use.test.ts | Implemented |
| REQ-115 | SCN-115a | `features/daily-surface/REQ-115.feature` | - | - | - | - | - | tests/unit/compact-use.test.ts | Implemented |
| REQ-116 | SCN-116a | `features/daily-surface/REQ-116.feature` | - | - | - | - | - | tests/unit/compact-use.test.ts | Implemented |
| REQ-117 | SCN-117a | `features/trusted-gate/REQ-117.feature` | - | - | - | - | - | tests/unit/trust-gate.test.ts | Implemented |
| REQ-118 | SCN-118a | `features/trusted-gate/REQ-118.feature` | - | - | - | - | - | tests/unit/trust-gate.test.ts | Implemented |
| REQ-119 | SCN-119a | `features/trusted-gate/REQ-119.feature` | - | - | - | - | - | tests/unit/trust-gate.test.ts | Implemented |
| REQ-120 | SCN-120a | `features/trusted-gate/REQ-120.feature` | - | - | - | - | - | tests/unit/trust-gate.test.ts | Implemented |
| REQ-121 | SCN-121a | `features/trusted-gate/REQ-121.feature` | - | - | - | - | - | tests/unit/trust-gate.test.ts | Implemented |
| REQ-122 | SCN-122a | `features/trusted-gate/REQ-122.feature` | - | - | - | - | - | tests/unit/trust-gate.test.ts | Implemented |
| REQ-123 | SCN-123a | `features/trusted-gate/REQ-123.feature` | - | - | - | - | - | tests/unit/trust-gate.test.ts | Implemented |
| REQ-124 | SCN-124a | `features/trusted-gate/REQ-124.feature` | - | - | - | - | - | tests/unit/trust-gate.test.ts | Implemented |
| REQ-125 | SCN-125a | `features/trusted-gate/REQ-125.feature` | - | - | - | - | - | tests/unit/trust-gate.test.ts | Implemented |
| REQ-126 | SCN-126a | `features/trusted-gate/REQ-126.feature` | - | - | - | - | - | tests/unit/trust-gate.test.ts | Implemented |
| REQ-127 | SCN-127a | `features/trusted-gate/REQ-127.feature` | - | - | - | - | - | tests/unit/trust-gate.test.ts | Implemented |
| REQ-128 | SCN-128a | `features/live-harness/REQ-128.feature` | - | - | - | - | - | tests/unit/live-view.test.ts | Implemented |
| REQ-129 | SCN-129a | `features/live-harness/REQ-129.feature` | - | - | - | - | - | tests/unit/live-view.test.ts | Implemented |
| REQ-130 | SCN-130a | `features/live-harness/REQ-130.feature` | - | - | - | - | - | tests/unit/live-view.test.ts | Implemented |
| REQ-131 | SCN-131a | `features/live-harness/REQ-131.feature` | - | - | - | - | - | tests/unit/live-view.test.ts | Implemented |
| REQ-132 | SCN-132a | `features/live-harness/REQ-132.feature` | - | - | - | - | - | tests/unit/live-view.test.ts | Implemented |
| REQ-133 | SCN-133a | `features/live-harness/REQ-133.feature` | - | - | - | - | - | tests/unit/live-view.test.ts | Implemented |
| REQ-134 | SCN-134a | `features/live-harness/REQ-134.feature` | - | - | - | - | - | tests/unit/live-view.test.ts | Implemented |
| REQ-135 | SCN-135a | `features/brief-cards/REQ-135.feature` | - | - | - | - | - | tests/unit/brief-cards.test.ts | Implemented |
| REQ-136 | SCN-136a | `features/brief-cards/REQ-136.feature` | - | - | - | - | - | tests/unit/brief-cards.test.ts | Implemented |
| REQ-137 | SCN-137a | `features/brief-cards/REQ-137.feature` | - | - | - | - | - | tests/unit/brief-cards.test.ts | Implemented |
| REQ-138 | SCN-138a | `features/brief-cards/REQ-138.feature` | - | - | - | - | - | tests/unit/brief-cards.test.ts | Implemented |
| REQ-139 | SCN-139a | `features/brief-cards/REQ-139.feature` | - | - | - | - | - | tests/unit/brief-cards.test.ts | Implemented |
| REQ-140 | SCN-140a | `features/brief-cards/REQ-140.feature` | - | - | - | - | - | tests/unit/brief-cards.test.ts | Implemented |
| REQ-141 | SCN-141a | `features/brief-cards/REQ-141.feature` | - | - | - | - | - | tests/unit/brief-cards.test.ts | Implemented |
| REQ-142 | SCN-142a | `features/brief-cards/REQ-142.feature` | - | - | - | - | - | tests/unit/brief-cards.test.ts | Implemented |
| REQ-143 | SCN-143a | `features/ticket-source/REQ-143.feature` | - | - | - | - | - | tests/unit/ticket-source.test.ts | Implemented |
| REQ-144 | SCN-144a | `features/ticket-source/REQ-144.feature` | - | - | - | - | - | tests/unit/ticket-source.test.ts | Implemented |
| REQ-145 | SCN-145a | `features/ticket-source/REQ-145.feature` | - | - | - | - | - | tests/unit/ticket-source.test.ts | Implemented |
| REQ-146 | SCN-146a | `features/ticket-source/REQ-146.feature` | - | - | - | - | - | tests/unit/ticket-source.test.ts | Implemented |
| REQ-147 | SCN-147a | `features/ticket-source/REQ-147.feature` | - | - | - | - | - | tests/unit/ticket-source.test.ts | Implemented |
| REQ-148 | SCN-148a | `features/ticket-source/REQ-148.feature` | - | - | - | - | - | tests/unit/ticket-source.test.ts | Implemented |
| REQ-149 | SCN-149a | `features/ticket-source/REQ-149.feature` | - | - | - | - | - | tests/unit/ticket-source.test.ts | Implemented |
| REQ-150 | SCN-150a | `features/ticket-source/REQ-150.feature` | - | - | - | - | - | tests/unit/ticket-source.test.ts | Implemented |
| REQ-152 | SCN-152a | `features/trusted-gate/REQ-152.feature` | - | - | - | - | - | tests/unit/ticket-source.test.ts | Implemented |
| REQ-153 | SCN-153a | `features/ticket-source/REQ-153.feature` | - | - | - | - | - | tests/unit/ticket-source.test.ts | Implemented |
| REQ-154 | SCN-154a | `features/ticket-source/REQ-154.feature` | - | - | - | - | - | tests/unit/ticket-source.test.ts | Implemented |
| REQ-155 | SCN-155a | `features/ticket-source/REQ-155.feature` | - | - | - | - | - | tests/unit/ticket-source.test.ts | Implemented |
| REQ-156 | SCN-156a | `features/ticket-source/REQ-156.feature` | - | - | - | - | - | tests/unit/ticket-source.test.ts | Implemented |
| REQ-157 | SCN-157a | `features/ticket-source/REQ-157.feature` | - | - | - | - | - | tests/unit/ticket-source.test.ts | Implemented |
| REQ-158 | SCN-158a | `features/ticket-source/REQ-158.feature` | - | - | - | - | - | tests/unit/ticket-source.test.ts | Implemented |
| REQ-159 | SCN-159a | `features/ticket-source/REQ-159.feature` | - | - | - | - | - | tests/unit/ticket-source.test.ts | Implemented |
| REQ-160 | SCN-160a | `features/trusted-gate/REQ-160.feature` | - | - | - | - | - | tests/unit/change-overlap.test.ts | Implemented |
| REQ-161 | SCN-161a | `features/ticket-source/REQ-161.feature` | - | - | - | - | - | tests/unit/ticket-source.test.ts | Implemented |
| REQ-162 | SCN-162a | `features/ticket-source/REQ-162.feature` | - | - | - | - | - | tests/unit/ticket-source.test.ts | Implemented |

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
