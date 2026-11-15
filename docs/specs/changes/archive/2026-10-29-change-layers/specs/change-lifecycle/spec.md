# Delta — change-lifecycle

## ADDED Requirements

### Requirement: REQ-282 — A change has three layers, each with its owner

The system SHALL scaffold a new change, with `specgate change new`, under the `layered` schema with three layers: `discover.md`, owned by product (business context, use case, acceptance criteria), `design.md`, owned by the architect (modules, mechanisms, channels, decisions), and `tasks.md`, owned by the developer (verifiable tasks naming their requirement), each file stating its owner.

#### Scenario: SCN-282a — A new change

- GIVEN a project with no active change
- WHEN `specgate change new add-pricing --json` runs
- THEN the change holds `discover.md`, `design.md` and `tasks.md`, each with an `Owner:` line naming product, architect and developer, its `change.yaml` says `schema: layered`, and no `proposal.md` is written

<!-- specgate:trace status=Implemented test=tests/unit/change-layers.test.ts actor=Developer kind=functional -->

### Requirement: REQ-283 — A 0.27 change stays valid, and names the upgrade

The system SHALL read a change without `discover.md` — the 0.27 layout — with its `proposal.md` as its Discover, SHALL validate it as before, SHALL warn when it has no `design.md` with a fix naming `specgate migrate 1.0`, and SHALL offer that migration a `design.md` drafted from the proposal, listing every acceptance criterion the proposal states.

#### Scenario: SCN-283a — A change written with 0.27

- GIVEN a change with `proposal.md`, `tasks.md`, a valid delta and `schema: spec-driven`
- WHEN `specgate change validate` runs
- THEN it passes with exit 0 and a `layer_no_design` warning whose fix names `specgate migrate 1.0`

#### Scenario: SCN-283b — The migration's design

- GIVEN a proposal whose Approach says "a pricing table per region" and whose criteria list `AC-1: peak rate above 100 orders`
- WHEN the migration asks for its design
- THEN the design's Mechanisms carry "a pricing table per region" and list `AC-1` to be answered

<!-- specgate:trace status=Implemented test=tests/unit/change-layers.test.ts actor=Developer kind=functional -->

### Requirement: REQ-284 — The Discover says what, not how

The system SHALL warn, on `change validate`, when the Discover of a layered change names a technology — a framework, a database, an API, an endpoint, a queue — with a fix saying the technology goes in `design.md`.

#### Scenario: SCN-284a — A database in the business story

- GIVEN a layered change whose Discover says "the prices are stored in PostgreSQL"
- WHEN `specgate change validate` runs
- THEN it warns `layer_discover_technical`, naming PostgreSQL

<!-- specgate:trace status=Implemented test=tests/unit/change-layers.test.ts actor=Developer kind=business-rule -->

### Requirement: REQ-285 — The Design answers every acceptance criterion

The system SHALL warn, on `change validate`, for each acceptance criterion of the Discover (`- AC-1: …` under "Acceptance criteria") that `design.md` does not name, and `change validate --strict` SHALL fail on it.

#### Scenario: SCN-285a — A criterion the design forgot

- GIVEN a Discover with `AC-1` and `AC-2`, and a design that answers only `AC-1`
- WHEN `specgate change validate --strict` runs
- THEN it exits 1 with `layer_design_misses_criterion` for `AC-2` and none for `AC-1`

<!-- specgate:trace status=Implemented test=tests/unit/change-layers.test.ts actor=Developer kind=business-rule -->

### Requirement: REQ-286 — Every task names the requirement it delivers

The system SHALL warn, on `change validate`, for each task of a layered change's `tasks.md` that names no requirement (`REQ-NNN`), except the specification tasks under a "Specification" heading.

#### Scenario: SCN-286a — A task with no requirement

- GIVEN a layered change whose implementation tasks are "2.1 REQ-005 — the price list" and "2.2 Refactor the client"
- WHEN `specgate change validate` runs
- THEN it warns `layer_task_without_requirement` for "2.2 Refactor the client" only

<!-- specgate:trace status=Implemented test=tests/unit/change-layers.test.ts actor=Developer kind=business-rule -->

### Requirement: REQ-287 — The business story stays put

The system SHALL warn, on `change validate`, when a layered change's `discover.md` differs — beyond whitespace and comments — from the version it was agreed at: the one in the commit that recorded the change's approval, or else its first committed version.

#### Scenario: SCN-287a — The story rewritten during the design

- GIVEN a layered change whose `discover.md` was committed with "AC-1: peak rate above 100 orders"
- WHEN the working copy changes it to "AC-1: peak rate above 500 orders" and `specgate change validate` runs
- THEN it warns `layer_discover_rewritten`, naming the commit the story was agreed at

<!-- specgate:trace status=Implemented test=tests/unit/change-layers.test.ts actor=Developer kind=business-rule -->

### Requirement: REQ-288 — Status and drafting name the layers

The system SHALL have `specgate change status` list a layered change's artifacts as discover, specs, design and tasks, counting a layer still as `change new` wrote it as not written, with each next step naming the file and its owner; and `specgate propose --from-brief` and `--from-ticket` SHALL scaffold the three layers, their DRAFTING.md saying which layer the agent writes.

#### Scenario: SCN-288a — The next layer and its owner

- GIVEN a layered change fresh from `change new`
- WHEN `specgate change status --json` runs
- THEN the artifacts are discover, specs, design and tasks, and a next step reads "Write discover.md (product)"

#### Scenario: SCN-288b — A module drafted from the brief

- GIVEN a project whose brief lists the module "pricing"
- WHEN `specgate propose --from-brief pricing` runs
- THEN the draft holds `discover.md`, `design.md` and `tasks.md` under `schema: layered`, and its DRAFTING.md names the three layers

<!-- specgate:trace status=Implemented test=tests/unit/change-layers.test.ts actor=Developer kind=functional -->

### Requirement: REQ-289 — The studio's review shows the layers

The system SHALL list, in the studio's review of a draft, the change's layers with their owners and whether each is written.

#### Scenario: SCN-289a — Reviewing a layered draft

- GIVEN a layered draft whose Discover is written and whose design is still the template
- WHEN the studio's review data is read (`/api/drafts`)
- THEN the draft lists discover (product, written), design (architect, not written) and tasks (developer)

<!-- specgate:trace status=Implemented test=tests/unit/change-layers.test.ts actor=Developer kind=functional -->

## MODIFIED Requirements

### Requirement: REQ-100 — A change is a reviewable folder

El sistema SHALL representar un cambio propuesto como un directorio bajo
`docs/specs/changes/<change-id>/` que contiene sus capas — `discover.md`,
`design.md` y `tasks.md`, o la propuesta de un cambio de 0.27 — y los deltas de
especificación que el cambio introduce.

#### Scenario: SCN-100a — Crear un cambio

- GIVEN un proyecto spec-driven sin cambios activos
- WHEN el usuario ejecuta `specgate change new add-dynamic-pricing`
- THEN se crea el directorio del cambio con `discover.md`, `design.md`, `tasks.md` y `change.yaml`
- AND se reserva un rango de identificadores REQ que ningún otro cambio puede usar

<!-- specgate:trace status=Implemented test=tests/unit/change-layers.test.ts actor=Developer kind=functional -->
