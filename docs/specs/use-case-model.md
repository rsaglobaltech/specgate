# The use-case model — specification

Status: **Accepted design, not implemented.** Decided in
[ADR-0027](adr/0027-use-cases-are-a-layer-not-a-column.md) (use cases) and
[ADR-0028](adr/0028-architecture-conformance-is-part-of-the-gate.md)
(architecture). Implemented in the phases at the end; each phase is a release.

---

## 1. Profiles decide what exists

| Profile (ADR-0022) | Elements | Who it is for |
|---|---|---|
| `minimal` | requirement → scenario → test | Scripts, sites, small services. **Today's model, unchanged.** |
| `layered` | + use cases, requirement kinds, N:M, gold-plating | Teams that work from use cases |
| `tactical-ddd` | + entities and events per use case | Complex domains |

`ARCHITECTURE=` sets it at `init`; changing it later is one line in the
project config (`specgate config set profile` is a different setting — the
help profile — and is not reused). Moving up a profile adds checks, never
migrates files.

## 2. Requirement kinds

A requirement keeps its `## REQ-NNN — title` section in `spec.md` or a
capability spec. Its `csda:trace` comment gains `kind`:

```markdown
## REQ-011 — Card authorisation answers within 2 seconds

<!-- csda:trace kind=non-functional -->
```

| `kind` | Default | Enters a use case as | Owes when delivered |
|---|---|---|---|
| `functional` | yes | steps of a main or alternative flow | its use cases' paths, each tested |
| `non-functional` | | a constraint on a step | a test tagged `@REQ-NNN`, **or** `verified-elsewhere="<where>"` in its comment |
| `business-rule` | | a precondition or an alternative flow | at least one alternative-flow scenario that exercises it |

`specgate new "<title>" --kind business-rule` writes it. `minimal` projects
ignore `kind`.

## 3. A use case is a file

One file per use case: `docs/specs/use-cases/UC-NNN-<slug>.md`.

```markdown
# UC-012 — Checkout

<!-- csda:uc realises=REQ-003,REQ-004,REQ-007,REQ-009,REQ-011 actor="Customer"
     include=UC-002 significant=true bpmn=processes/sales.bpmn#Task_Checkout -->

## Preconditions
- The cart is not empty.
- REQ-009 — buyers of age-restricted items are adults.

## Main flow
1. The customer confirms the cart.
2. The system computes VAT for the delivery country (REQ-003).
3. The system authorises the card (REQ-011: under 2 s).
4. The system reserves stock (REQ-004) and emails a receipt (REQ-007).

## Alternative flows
### A1 — Card declined
### A2 — Underage buyer (REQ-009)

## Touches
- Order, Payment, Stock          <!-- tactical-ddd only -->
```

| Field (in `csda:uc`) | Required | Meaning |
|---|---|---|
| `realises` | yes | Requirement ids this use case satisfies. **The N:M relation lives here, and only here.** |
| `actor` | yes | Who starts it |
| `include` / `extend` | no | Other use cases it reuses or optionally extends |
| `significant` | no | Architecturally significant (ASUC): owes the architecture check |
| `bpmn` | no | Path and element id of the process it models |

Section headings are fixed so the tool can read flow ids (`Main flow`, `A1`,
`A2`, …). The prose is for people; the tool reads ids and the comment only.

`specgate new --use-case "Checkout" --realises REQ-003,REQ-004` writes the
skeleton. On a codebase organised by use case (`…/usecases/checkout/`,
`…/application/checkout/`), `init` proposes one skeleton per folder, with no
`realises` yet — a proposal, never a claim.

## 4. Scenarios are paths

With use cases, a scenario is one path through one use case:

```gherkin
@UC-012 @SCN-031 @main
Scenario: A customer checks out a cart delivered to Spain

@UC-012 @SCN-032 @A2 @REQ-009
Scenario: An underage buyer cannot check out an age-restricted item
```

- `@UC-NNN` and `@SCN-NNN` are required; the path tag (`@main`, `@A1`, …)
  names the flow it walks.
- A requirement is covered **through** the use cases that realise it. Adding
  `@REQ-NNN` is optional — it is how a business rule or a non-functional
  requirement says *this* path is the one that exercises it.
- Tests link exactly as today: a test that mentions `SCN-031`, `UC-012` or the
  requirement is linked to it.

`minimal` projects keep tagging `@REQ-NNN @SCN-NNN`. Both forms validate.

## 5. The graph

Everything is derived; nothing below is edited by hand.

| Node | Declared in |
|---|---|
| Requirement | `spec.md`, capability specs |
| Use case | `docs/specs/use-cases/*.md` |
| Scenario | `features/**/*.feature` |
| Test, code | files that mention an id |
| Entity | a use case's `Touches` (tactical-ddd) |

| Edge | From |
|---|---|
| use case **realises** requirement | `csda:uc realises=` |
| use case **includes / extends** use case | `csda:uc include= / extend=` |
| scenario **walks** use-case path | scenario tags |
| scenario **exercises** requirement | `@REQ-NNN` on the scenario, or through its use case |
| test **proves** scenario | mention |
| use case **touches** entity | `Touches` section |

**Generated outputs**

- `docs/specs/traceability.md` — unchanged shape, one row per scenario; its
  `Use Case` column is filled from the scenario's `@UC-NNN`.
- `docs/specs/use-case-matrix.md` (`layered` and up) — requirements × use
  cases, with coverage per cell: the N:M view, regenerated by `check`.

**Views**

```bash
specgate trace REQ-007        # use cases that realise it, their paths, tests, status
specgate trace UC-012         # requirements it realises, includes, paths, tests
specgate impact Invoice       # use cases that touch it → requirements → scenarios
specgate impact src/billing/  # the same, starting from code
```

Both accept `--json` under the agent contract. `status` gains one line per
use case only in `layered` and up.

## 6. What the gate collects

A `Draft` requirement owes nothing, as today. From delivery on:

| Code | Severity | When |
|---|---|---|
| `uc_realises_unknown_requirement` | error | `realises` names an id no spec section has |
| `requirement_not_realised` | error | a delivered functional requirement no use case realises |
| `uc_path_untested` | error | a use case realising a delivered requirement has a path with no scenario, or a scenario no test proves |
| `uc_gold_plating` | warning; error with `strict_use_cases: true` | a use case realises nothing |
| `nfr_unverified` | error | a delivered non-functional requirement with no tagged test and no `verified-elsewhere` |
| `business_rule_unexercised` | error | a delivered business rule no alternative-flow scenario tags |
| `asuc_without_arch_check` | error | a significant use case realising a delivered requirement, and no `arch_cmd` |
| `uc_include_cycle` | error | `include`/`extend` form a cycle |
| `requirement_spans_many_use_cases` | warning | more than 4 use cases realise one requirement — probably an epic |

Each carries a `fix`, as every diagnostic does. `done REQ-NNN` runs these for
the requirement it closes.

## 7. The issue tracker

The tracker mirrors the model (ADR-0021); stories are not stored in the repo.

| Tracker | Model |
|---|---|
| Epic | a capability, or a large use case |
| Story | one or more paths of one use case |

A story names what it slices with a label — `uc:UC-012`, `path:A2` — and
`specgate alm status` reports, per story, whether the paths it names have
passing scenarios. `alm sync` creates nothing from use cases; a story is
planning, and planning stays in the tracker.

## 8. Packs

`schemas/pack.schema.json`:

- `use_cases[].requirement` (one id) gains `use_cases[].requirements` (a list).
  A pack using the single field still validates; it reads as a one-item list.
- `use_cases[]` gains optional `include`, `extend`, `significant`.
- `requirements[]` gains optional `kind`.

`expand` writes one use-case file per pack use case.

## 9. Architecture (ADR-0028)

```yaml
# harness.config.yaml
test_cmd: ./mvnw -B test
arch_cmd: ./mvnw -B test -Dtest='*ArchTest'
arch_sarif: target/arch-results.sarif     # optional
```

| Runs in | Order |
|---|---|
| `specgate check` | `validate --strict` → `arch_cmd` → `test_cmd` |
| `specgate done` | the same, for the requirement it closes |
| harness gate | the same; a failure is fed back to the agent |

`specgate arch baseline` writes `.specgate/arch-baseline.json` from the SARIF
findings; afterwards only findings not in it fail (`arch_violation_new`). The
baseline growing needs `--accept-new`, and shows in review. Without SARIF the
exit code decides and `check` says the baseline cannot apply.

Recipes in the docs, one per language: ArchUnit / Konsist (JVM), ArchUnitNET /
NetArchTest (.NET), dependency-cruiser (TS/JS), import-linter (Python),
go-arch-lint (Go), Deptrac (PHP), Semgrep (any).

**Later (phase 5):** `uc_touches_undeclared_entity` — a use case's code imports
an entity its `Touches` does not list. Needs an import graph per language,
read from the tools above where they export one.

## 10. Phases

Each phase is one release, behind its profile; `minimal` never changes.

| Phase | Ships | Done when |
|---|---|---|
| **1** | `arch_cmd`, SARIF, `arch baseline`, in `check`, `done`, harness | a legacy Java repo with ArchUnit adopts green, and a new violation fails `check` and the harness |
| **2** | requirement `kind`; use-case files; `@UC` path scenarios; the graph; `use-case-matrix.md`; `trace`; the gate codes of §6 | Checkout realising five requirements has its scenarios written once, and each requirement's coverage is reported through it |
| **3** | `init` proposes use cases from folders; `use-cases.md` table → files (lossless or nothing); pack schema N:M | a repo organised by use case adopts with one proposed file per folder |
| **4** | tracker mapping: `uc:`/`path:` labels, `alm status` per story | a Jira story slicing A2 shows whether A2's scenarios pass |
| **5** | `impact`; entities; `uc_touches_undeclared_entity` | `impact Invoice` lists the requirements at stake |
| **6** | BPMN link checked: the element id exists in the file | a renamed BPMN task fails the link |

## 11. Out of scope

- Drawing UML or BPMN. Specgate reads ids; diagrams stay in the tools that draw them.
- Estimation, sprints, boards. Scrum or Kanban is the tracker's business.
- A rule language for architecture.

---

## Next

- [How Specgate thinks](../concepts.md) — the model this extends
- [ADR-0027](adr/0027-use-cases-are-a-layer-not-a-column.md) ·
  [ADR-0028](adr/0028-architecture-conformance-is-part-of-the-gate.md)
