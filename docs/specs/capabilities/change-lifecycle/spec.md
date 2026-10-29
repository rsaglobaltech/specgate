# Change Lifecycle

## Purpose

Propose, review and archive a change to the specification as a reviewable unit
of intent.

## Requirements

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

<!-- specgate:trace actor=Developer feature=features/change-lifecycle/REQ-100.feature kind=functional status=Implemented test=tests/unit/change-layers.test.ts -->

### Requirement: REQ-101 — Los deltas expresan la diferencia, no el estado final

El sistema SHALL aceptar deltas con secciones `ADDED`, `MODIFIED` y `REMOVED`, y
SHALL rechazar cualquier otra sección de operación con un diagnóstico accionable.

#### Scenario: SCN-101a — Sección desconocida

- GIVEN un delta con una sección `## CHANGED Requirements`
- WHEN el usuario ejecuta `specgate change validate`
- THEN la validación falla con el código `delta_unknown_section`
- AND el diagnóstico enumera las secciones válidas

### Requirement: REQ-102 — Un requisito sin escenario no es archivable

El sistema SHALL rechazar todo requisito `ADDED` o `MODIFIED` que no declare al
menos un escenario, porque sin escenario "hecho" no está definido.

#### Scenario: SCN-102a — Requisito sin escenario

- GIVEN un delta cuyo requisito no declara ningún escenario
- WHEN el usuario ejecuta `specgate change validate`
- THEN la validación falla con el código `requirement_without_scenario`

### Requirement: REQ-103 — Archivar arma el gate, no solo mueve markdown

El sistema SHALL, al archivar un cambio, fusionar sus deltas en la spec de la
capability, insertar o actualizar las filas correspondientes de
`docs/specs/traceability.md` a partir de los comentarios `specgate:trace`, y copiar
los ficheros `.feature` propuestos al árbol `features/` del proyecto.

#### Scenario: SCN-103a — Archivado completo

- GIVEN un cambio válido con un delta y un `.feature` propuesto
- WHEN el usuario ejecuta `specgate change archive <id>`
- THEN la spec de la capability contiene el requisito
- AND la matriz de trazabilidad contiene su fila
- AND el `.feature` existe bajo `features/`
- AND `specgate plan` lista el requisito como pendiente de test e implementación

### Requirement: REQ-104 — El archivado es transaccional

El sistema SHALL revertir toda escritura ya realizada si cualquier paso del
archivado falla, dejando el proyecto exactamente como estaba.

#### Scenario: SCN-104a — Fallo a mitad de escritura

- GIVEN un archivado que falla al escribir el último fichero
- WHEN el motor de archivado detecta el error
- THEN los ficheros ya escritos vuelven a su contenido anterior
- AND el directorio del cambio permanece sin archivar

### Requirement: REQ-105 — Un upsert nunca degrada el estado de un requisito

El sistema SHALL preservar las columnas de la matriz de trazabilidad sobre las
que el delta no se pronuncia, y en particular SHALL NOT devolver a `Draft` un
requisito ya marcado como `Implemented`.

#### Scenario: SCN-105a — Cambio sobre un requisito implementado

- GIVEN un requisito con estado `Implemented` y artefacto de test registrado
- WHEN se archiva un cambio que solo modifica su caso de uso
- THEN el estado sigue siendo `Implemented`
- AND el artefacto de test se conserva

### Requirement: REQ-106 — Un proyecto sin cambios sigue funcionando

El sistema SHALL tratar la ausencia de `docs/specs/changes/` como "sin cambios
activos" y SHALL NOT fallar por ello en ningún comando.

#### Scenario: SCN-106a — Proyecto anterior al ciclo de cambio

- GIVEN un proyecto generado antes de esta funcionalidad
- WHEN el usuario ejecuta `specgate validate .` o `specgate change list`
- THEN el comando termina con éxito
- AND informa de que no hay cambios activos

### Requirement: REQ-177 — An open draft can reserve more ids while its range is the last

The system SHALL, when `specgate propose --from-brief <module> --reserve <n>` names a draft that is already open, grow its `req_range` to n requirement ids and its `scn_range` to three scenario ids per requirement, from the same first ids, and rewrite its DRAFTING.md with the new ranges; it SHALL refuse with `draft_range_not_last` when a requirement or scenario id after the draft's range is reserved or used elsewhere, and with `draft_range_already_holds` when n is not more than the draft holds, changing nothing.

#### Scenario: SCN-177a — The last draft grows

- GIVEN a project whose only open draft, draft-bookings, holds REQ-001…REQ-010 and SCN-001…SCN-030
- WHEN the developer runs `specgate propose --from-brief bookings --reserve 15`
- THEN change.yaml holds REQ-001…REQ-015 and SCN-001…SCN-045, DRAFTING.md names REQ-015, and the next draft opened starts at REQ-016

#### Scenario: SCN-177b — A draft followed by another cannot grow

- GIVEN draft-bookings holds REQ-001…REQ-010 and draft-coupons was opened after it
- WHEN the developer runs `specgate propose --from-brief bookings --reserve 15`
- THEN the command exits 1 with draft_range_not_last naming REQ-011, and change.yaml is unchanged

#### Scenario: SCN-177c — Asking for fewer than it holds

- GIVEN draft-bookings holds ten ids
- WHEN the developer runs `specgate propose --from-brief bookings --reserve 5`
- THEN the command exits 1 saying it already holds 10, and change.yaml is unchanged

<!-- specgate:trace actor=Developer feature=features/change-lifecycle/REQ-177.feature kind=functional status=Implemented test=tests/unit/draft-reserve-more.test.ts -->

### Requirement: REQ-190 — Modifying a delivered requirement starts from its text

The system SHALL, with `specgate change new <id> --modify <REQ>` (repeatable), write into the change a `MODIFIED Requirements` delta for each requirement's capability holding the requirement as the capability spec has it, its statement, scenarios and trace, with its status set to `Draft`, and SHALL refuse a requirement no capability spec defines, or one an open change already modifies, naming that change.

#### Scenario: SCN-190a — The requirement copied, reopened alone

- GIVEN capability fichas defines REQ-017 as Implemented with scenarios SCN-048 to SCN-050
- WHEN `specgate change new gears --modify REQ-017` runs
- THEN the change's fichas delta has REQ-017 under MODIFIED with its statement, SCN-048 to SCN-050 and status Draft, and no other requirement of fichas changes status

#### Scenario: SCN-190b — What cannot be modified is refused

- GIVEN REQ-999 is defined nowhere and change gears already modifies REQ-017
- WHEN `specgate change new other --modify REQ-999` or `--modify REQ-017` runs
- THEN it is refused, saying REQ-999 is not in a capability spec, or that gears already modifies REQ-017

<!-- specgate:trace actor=Developer feature=features/change-lifecycle/REQ-190.feature kind=functional status=Implemented test=tests/unit/change-evolution.test.ts -->

### Requirement: REQ-191 — What a change to a requirement touches

The system SHALL list with `specgate change impact <REQ|change>` (`--json` too), for each requirement, the spec file and line that define it, its feature files, the tests that name it, the files its commits changed (commits whose message names it), and the other requirements whose text or scenarios name it; for a change, it SHALL do so for every requirement the change modifies or removes.

#### Scenario: SCN-191a — The impact of one requirement

- GIVEN REQ-017 is defined in capabilities/fichas, has features/fichas/REQ-017.feature, a test naming it, a commit "feat(REQ-017)" that changed FichasContent.ts, and REQ-085 names REQ-017
- WHEN `specgate change impact REQ-017` runs
- THEN it lists the spec file and line, the feature, the test, FichasContent.ts and REQ-085

#### Scenario: SCN-191b — The impact of a change

- GIVEN change gears modifies REQ-017 and REQ-018
- WHEN `specgate change impact gears` runs
- THEN it lists the impact of REQ-017 and of REQ-018

<!-- specgate:trace actor=Developer feature=features/change-lifecycle/REQ-191.feature kind=functional status=Implemented test=tests/unit/change-evolution.test.ts -->

### Requirement: REQ-192 — A new requirement for a module the brief already covers

The system SHALL, with `specgate brief add <module> "<text>"`, refuse a module the brief's front matter does not list, append the text to the brief under "Additions" with the module and the date, and add to the module's open change (or create one, `<module>-additions`, reserving an id) an ADDED requirement whose title and statement are left for the author and whose source quotes the text, so the draft checklist asks for them.

#### Scenario: SCN-192a — A module already archived gets a change

- GIVEN module fichas is listed in the brief and has no open change
- WHEN `specgate brief add fichas "Subir de marcha paso a paso"` runs
- THEN the brief gains the line under "Additions" with fichas and the date, and change fichas-additions is created with one ADDED requirement quoting "Subir de marcha paso a paso"

#### Scenario: SCN-192b — A module with an open change grows it

- GIVEN module examen has the open change draft-examen
- WHEN `specgate brief add examen "Situaciones de noche"` runs
- THEN draft-examen gains an ADDED requirement quoting the text with the next free id of its range; with the range used up, it is refused saying how to grow it

#### Scenario: SCN-192c — An unknown module is refused

- GIVEN the brief lists no module "garaje"
- WHEN `specgate brief add garaje "x"` runs
- THEN it is refused with the modules the brief lists, and nothing is written

<!-- specgate:trace actor=Developer feature=features/change-lifecycle/REQ-192.feature kind=functional status=Implemented test=tests/unit/change-evolution.test.ts -->

### Requirement: REQ-202 — Only defined ids reserve the next ones

The system SHALL take the highest reserved requirement id, on this branch and on others, only from the lines that define or reserve one — a heading, a matrix row's first cells, a `req_range` — and not from a mention in a requirement's or scenario's text.

#### Scenario: SCN-202a — A mention in a scenario reserves nothing

- GIVEN the highest requirement is REQ-018 and a scenario says "GIVEN REQ-999 is defined nowhere"
- WHEN a change reserves two ids
- THEN it gets REQ-019 and REQ-020

<!-- specgate:trace actor=Developer feature=features/change-lifecycle/REQ-202.feature kind=functional status=Implemented test=tests/unit/change-evolution.test.ts -->

### Requirement: REQ-282 — A change has three layers, each with its owner

The system SHALL scaffold a new change, with `specgate change new`, under the `layered` schema with three layers: `discover.md`, owned by product (business context, use case, acceptance criteria), `design.md`, owned by the architect (modules, mechanisms, channels, decisions), and `tasks.md`, owned by the developer (verifiable tasks naming their requirement), each file stating its owner.

#### Scenario: SCN-282a — A new change

- GIVEN a project with no active change
- WHEN `specgate change new add-pricing --json` runs
- THEN the change holds `discover.md`, `design.md` and `tasks.md`, each with an `Owner:` line naming product, architect and developer, its `change.yaml` says `schema: layered`, and no `proposal.md` is written

<!-- specgate:trace actor=Developer feature=features/change-lifecycle/REQ-282.feature kind=functional status=Implemented test=tests/unit/change-layers.test.ts -->

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

<!-- specgate:trace actor=Developer feature=features/change-lifecycle/REQ-283.feature kind=functional status=Implemented test=tests/unit/change-layers.test.ts -->

### Requirement: REQ-284 — The Discover says what, not how

The system SHALL warn, on `change validate`, when the Discover of a layered change names a technology — a framework, a database, an API, an endpoint, a queue — with a fix saying the technology goes in `design.md`.

#### Scenario: SCN-284a — A database in the business story

- GIVEN a layered change whose Discover says "the prices are stored in PostgreSQL"
- WHEN `specgate change validate` runs
- THEN it warns `layer_discover_technical`, naming PostgreSQL

<!-- specgate:trace actor=Developer feature=features/change-lifecycle/REQ-284.feature kind=business-rule status=Implemented test=tests/unit/change-layers.test.ts -->

### Requirement: REQ-285 — The Design answers every acceptance criterion

The system SHALL warn, on `change validate`, for each acceptance criterion of the Discover (`- AC-1: …` under "Acceptance criteria") that `design.md` does not name, and `change validate --strict` SHALL fail on it.

#### Scenario: SCN-285a — A criterion the design forgot

- GIVEN a Discover with `AC-1` and `AC-2`, and a design that answers only `AC-1`
- WHEN `specgate change validate --strict` runs
- THEN it exits 1 with `layer_design_misses_criterion` for `AC-2` and none for `AC-1`

<!-- specgate:trace actor=Developer feature=features/change-lifecycle/REQ-285.feature kind=business-rule status=Implemented test=tests/unit/change-layers.test.ts -->

### Requirement: REQ-286 — Every task names the requirement it delivers

The system SHALL warn, on `change validate`, for each task of a layered change's `tasks.md` that names no requirement (`REQ-NNN`), except the specification tasks under a "Specification" heading.

#### Scenario: SCN-286a — A task with no requirement

- GIVEN a layered change whose implementation tasks are "2.1 REQ-005 — the price list" and "2.2 Refactor the client"
- WHEN `specgate change validate` runs
- THEN it warns `layer_task_without_requirement` for "2.2 Refactor the client" only

<!-- specgate:trace actor=Developer feature=features/change-lifecycle/REQ-286.feature kind=business-rule status=Implemented test=tests/unit/change-layers.test.ts -->

### Requirement: REQ-287 — The business story stays put

The system SHALL warn, on `change validate`, when a layered change's `discover.md` differs — beyond whitespace and comments — from the version it was agreed at: the one in the commit that recorded the change's approval, or else its first committed version.

#### Scenario: SCN-287a — The story rewritten during the design

- GIVEN a layered change whose `discover.md` was committed with "AC-1: peak rate above 100 orders"
- WHEN the working copy changes it to "AC-1: peak rate above 500 orders" and `specgate change validate` runs
- THEN it warns `layer_discover_rewritten`, naming the commit the story was agreed at

<!-- specgate:trace actor=Developer feature=features/change-lifecycle/REQ-287.feature kind=business-rule status=Implemented test=tests/unit/change-layers.test.ts -->

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

<!-- specgate:trace actor=Developer feature=features/change-lifecycle/REQ-288.feature kind=functional status=Implemented test=tests/unit/change-layers.test.ts -->

### Requirement: REQ-289 — The studio's review shows the layers

The system SHALL list, in the studio's review of a draft, the change's layers with their owners and whether each is written.

#### Scenario: SCN-289a — Reviewing a layered draft

- GIVEN a layered draft whose Discover is written and whose design is still the template
- WHEN the studio's review data is read (`/api/drafts`)
- THEN the draft lists discover (product, written), design (architect, not written) and tasks (developer)

<!-- specgate:trace actor=Developer feature=features/change-lifecycle/REQ-289.feature kind=functional status=Implemented test=tests/unit/change-layers.test.ts -->

### Requirement: REQ-310 — The roles of a project

The system SHALL read `roles:` from `harness.config.yaml` as a mapping from a role (product, architect, developer, security, …) to the people who hold it, each matched to the git identity of whoever runs a command (`user.email` or `user.name`, case-insensitive); a role nobody is named for SHALL be open to anyone.

#### Scenario: SCN-310a — Ana holds the product role

- GIVEN `roles: { product: [ana@acme.eu], architect: [carlos@acme.eu] }` and a git identity `ana@acme.eu`
- WHEN the roles of that person are asked for
- THEN they are product and developer — developer because nobody is named for it — and not architect

<!-- specgate:trace actor=Developer feature=features/change-lifecycle/REQ-310.feature kind=functional status=Implemented test=tests/unit/approvals.test.ts -->

### Requirement: REQ-311 — A layer is approved by the role that owns it

The system SHALL record `specgate change approve <id> --layer discover|design|tasks` only for a person holding the layer's owning role — product for the Discover, architect for the Design, developer for the Tasks — and SHALL refuse anyone else, naming the role; without `--layer` it SHALL approve every written layer the person owns.

#### Scenario: SCN-311a — The architect cannot approve the business story

- GIVEN roles naming ana@acme.eu as product and carlos@acme.eu as architect, and a change with all three layers written
- WHEN carlos@acme.eu runs `change approve <id> --layer discover`
- THEN it is refused with `approve_not_owner` naming the product role, and `--layer design` is recorded

<!-- specgate:trace actor=Developer feature=features/change-lifecycle/REQ-311.feature kind=functional status=Implemented test=tests/unit/approvals.test.ts -->

### Requirement: REQ-312 — How many people a layer needs

The system SHALL count a layer approved once as many distinct people as `approvals.quorum.<layer>` says (default 1) have approved its current text.

#### Scenario: SCN-312a — Two architects for the design

- GIVEN `approvals: { quorum: { design: 2 } }` and two people in the architect role
- WHEN the first of them approves the design
- THEN the design still waits for one approval, and it is approved once the second does; the same person twice counts once

<!-- specgate:trace actor=Developer feature=features/change-lifecycle/REQ-312.feature kind=functional status=Implemented test=tests/unit/approvals.test.ts -->

### Requirement: REQ-313 — Who approved which version

The system SHALL record each approval in the change's `approvals.json` — the layer, the person's name and email, the role, the hash of the layer's text and the date — so the record moves with the change into the archive.

#### Scenario: SCN-313a — The audit after the change is closed

- GIVEN a change whose three layers were approved
- WHEN `approvals.json` is read
- THEN it lists one entry per approval with layer, name, email, role, a sha256 hash of that layer and the date

<!-- specgate:trace actor=Developer feature=features/change-lifecycle/REQ-313.feature kind=functional status=Implemented test=tests/unit/approvals.test.ts -->

### Requirement: REQ-314 — A changed layer is approved again

The system SHALL count an approval only while the layer's text has the hash approved; a layer changed afterwards SHALL wait for a new approval, and the change SHALL no longer read as approved.

#### Scenario: SCN-314a — The design is rewritten after its approval

- GIVEN a change whose layers were all approved
- WHEN `design.md` is edited
- THEN the design waits for an approval again, the change is not approved, and the Discover's approval still counts

<!-- specgate:trace actor=Developer feature=features/change-lifecycle/REQ-314.feature kind=functional status=Implemented test=tests/unit/approvals.test.ts -->

### Requirement: REQ-315 — Nothing is built before its approvals

The system SHALL have `harness run` skip, before any worktree or agent, a requirement of an open change whose required approvals are missing, naming the layers that wait and the command that approves them. `approvals.required` SHALL say which changes need them: `layered` (the 1.0 default: changes of the layered schema), `always`, or `never` (the 0.27 behaviour).

#### Scenario: SCN-315a — A 1.0 change nobody approved

- GIVEN an open layered change adding REQ-002, not approved
- WHEN `harness run --req REQ-002` runs
- THEN REQ-002 is skipped with `harness_not_approved`, no agent runs, and with `approvals: { required: never }` it is attempted

<!-- specgate:trace actor=Developer feature=features/change-lifecycle/REQ-315.feature kind=functional status=Implemented test=tests/unit/approvals.test.ts -->

### Requirement: REQ-319 — The studio's Review shows and takes layer approvals

The system SHALL return, for each layer of a draft in the studio's `/api/drafts`, its approvals, how many it needs, whether it is approved and whether the viewer owns it; and SHALL record `POST /api/approve` with a `layer` for the viewer's git identity under the same rules as `change approve`.

#### Scenario: SCN-319a — Ana approves the Discover from the studio

- GIVEN a draft with its layers written and ana@acme.eu as product
- WHEN the studio is asked for the drafts and then posts an approval of the Discover as ana@acme.eu
- THEN the Discover reads as owned by the viewer, and after the post it is approved by ana@acme.eu

<!-- specgate:trace actor=Developer feature=features/change-lifecycle/REQ-319.feature kind=functional status=Implemented test=tests/unit/approvals.test.ts -->
