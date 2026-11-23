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

### Requirement: REQ-325 — A 0.27 change in progress is upgraded to the three layers

The system SHALL, on `specgate migrate 1.0`, upgrade every open change whose `change.yaml` says `schema: spec-driven` to the `layered` schema: its `proposal.md` becomes `discover.md` with its text unchanged, a `design.md` is drafted from the proposal, its `tasks.md` is kept, and no archived change is read or rewritten.

#### Scenario: SCN-325a — An open change written with 0.27

- GIVEN a committed project with an open change `add-rates` written with `change new --schema spec-driven`, its proposal stating "Rates come from the provider."
- WHEN the person runs `specgate migrate 1.0`
- THEN `add-rates` has `discover.md` with the proposal's text, a `design.md`, its `tasks.md`, no `proposal.md`, and `schema: layered` in `change.yaml`

#### Scenario: SCN-325b — A delivered change

- GIVEN the same project with an archived 0.27 change
- WHEN the person runs `specgate migrate 1.0`
- THEN every file under the archive is byte for byte as before

<!-- specgate:trace actor=Developer feature=features/change-lifecycle/REQ-325.feature kind=functional status=Implemented test=tests/unit/migrate.test.ts -->

### Requirement: REQ-326 — The migration can be previewed, and runs once

The system SHALL, on `specgate migrate 1.0 --dry-run`, print the same report a real run would and change no file; and SHALL, on a project already migrated, change nothing and say there is nothing left to migrate.

#### Scenario: SCN-326a — A preview

- GIVEN a project with an open 0.27 change
- WHEN the person runs `specgate migrate 1.0 --dry-run --json`
- THEN the report lists the change's actions, and no file in the project changed

#### Scenario: SCN-326b — A second run

- GIVEN a project migrated and committed
- WHEN the person runs `specgate migrate 1.0` again
- THEN it exits 0, plans no action and leaves every file as it was

<!-- specgate:trace actor=Developer feature=features/change-lifecycle/REQ-326.feature kind=functional status=Implemented test=tests/unit/migrate.test.ts -->

### Requirement: REQ-327 — The migration starts from a commit

The system SHALL refuse `specgate migrate 1.0` without `--dry-run` when the project has uncommitted changes or is not a git repository, naming how to commit or stash first, and SHALL change nothing.

#### Scenario: SCN-327a — Work not committed

- GIVEN a project with an open 0.27 change and an uncommitted edit
- WHEN the person runs `specgate migrate 1.0`
- THEN it exits 1 with `migrate_dirty_tree` and the change still has its `proposal.md`

<!-- specgate:trace actor=Developer feature=features/change-lifecycle/REQ-327.feature kind=functional status=Implemented test=tests/unit/migrate.test.ts -->

### Requirement: REQ-328 — The migration says what it did and what is left

The system SHALL write, when it changes anything, a report to `docs/specs/migration-1.0.md` and in `--json` that lists each step, the file actions it took and what a person must still do; the steps SHALL be one ordered table, so a step of a later 1.0 feature is added in one place.

#### Scenario: SCN-328a — The report of a real run

- GIVEN a project with an open 0.27 change
- WHEN the person runs `specgate migrate 1.0 --json`
- THEN `docs/specs/migration-1.0.md` names the change and `discover.md`, `design.md`, and lists reviewing the drafted design as a manual step, and the JSON has the same steps

<!-- specgate:trace actor=Developer feature=features/change-lifecycle/REQ-328.feature kind=functional status=Implemented test=tests/unit/migrate.test.ts -->

### Requirement: REQ-329 — Status names the migration

The system SHALL, on `specgate status`, while an open change says `schema: spec-driven`, print one line naming `specgate migrate 1.0` and the number of such changes, and add a `migrate` key to `--json`; with none it says nothing about it.

#### Scenario: SCN-329a — A 0.27 project opened with 1.0

- GIVEN a project with one open 0.27 change
- WHEN the person runs `specgate status`
- THEN the output names `specgate migrate 1.0` once, and `status --json` has `migrate.changes` = ["add-rates"]

<!-- specgate:trace actor=Developer feature=features/change-lifecycle/REQ-329.feature kind=functional status=Implemented test=tests/unit/migrate.test.ts -->

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

### Requirement: REQ-350 — change validate reports what approval refuses

The system SHALL, in `specgate change validate` of a layered change, report as errors the findings that `change approve` would refuse it for — the draft checklist's errors, such as a requirement with no kind, and its open questions — so validation never passes a change that approval then blocks.

#### Scenario: SCN-350a — A requirement with no kind

- GIVEN a layered change whose requirement has a trace with no `kind=`
- WHEN `specgate change validate` runs
- THEN it fails with `change_not_approvable` naming the missing kind, as `change approve` would

<!-- specgate:trace actor=Developer feature=features/change-lifecycle/REQ-350.feature kind=functional status=Implemented test=tests/unit/rc2-change.test.ts -->

### Requirement: REQ-351 — The agent writing a change's requirements is told what they need

The system SHALL tell the agent that writes a layered change's requirements (`change author --artifact specs`, `change instructions specs`) to give each requirement's trace a `kind=` (functional, non-functional or business-rule) and an `actor=`, and a feature file of its own.

#### Scenario: SCN-351a — The instructions for the specs of a layered change

- GIVEN a layered change
- WHEN `specgate change instructions specs <id>` runs
- THEN its rules name `kind=`, `actor=` and one feature file per requirement

<!-- specgate:trace actor=Developer feature=features/change-lifecycle/REQ-351.feature kind=functional status=Implemented test=tests/unit/rc2-change.test.ts -->

### Requirement: REQ-352 — Two requirements naming one feature file are reported

The system SHALL report, in `change validate` and when archiving, two requirements of a change whose traces name the same feature file, naming both and the file, since archiving lays one feature file per requirement and the second would replace the first's scenarios.

#### Scenario: SCN-352a — Three requirements, one feature file

- GIVEN a change whose REQ-002 and REQ-003 both trace `feature=features/x/follow.feature`
- WHEN `specgate change validate` runs
- THEN it fails with `change_feature_shared` naming REQ-002, REQ-003 and the file

<!-- specgate:trace actor=Developer feature=features/change-lifecycle/REQ-352.feature kind=functional status=Implemented test=tests/unit/rc2-change.test.ts -->

### Requirement: REQ-353 — A delivered requirement ticks its tasks

The system SHALL, when a requirement of an open change is delivered (`specgate done`, which the harness runs), tick the unchecked tasks of that change's `tasks.md` that name the requirement, so archiving warns only about tasks no delivered requirement names.

#### Scenario: SCN-353a — The harness delivered REQ-002

- GIVEN an open change whose tasks.md has `- [ ] 2.1 Build the panel (REQ-002)` and `- [ ] 2.2 Docs`
- WHEN `specgate done REQ-002` delivers it
- THEN the task naming REQ-002 is ticked and the other is not

<!-- specgate:trace actor=Developer feature=features/change-lifecycle/REQ-353.feature kind=functional status=Implemented test=tests/unit/rc2-change.test.ts -->

### Requirement: REQ-354 — The change command's help describes the three layers

The system SHALL describe, in `specgate change --help`, a new change as its three layers — discover, design and tasks — not as a proposal.

#### Scenario: SCN-354a — The help of change new

- GIVEN Specgate 1.0
- WHEN `specgate change --help` runs
- THEN the line for `new` names discover, design and tasks and not "proposal"

<!-- specgate:trace actor=Developer feature=features/change-lifecycle/REQ-354.feature kind=functional status=Implemented test=tests/unit/rc2-change.test.ts -->

### Requirement: REQ-370 — A ticked task keeps the approval of the tasks

The system SHALL take the approved content of a layer with its task boxes read as open, so that ticking a task — as delivering its requirement does (REQ-353), or by a person — keeps the layer's approvals, while any other edit of the layer still asks for them again (REQ-314).

#### Scenario: SCN-370a — The second requirement of an approved change

- GIVEN a layered change with REQ-002 and REQ-003, every layer approved
- WHEN REQ-002 is delivered and its task in tasks.md is ticked
- THEN the harness still accepts REQ-003 as approved

#### Scenario: SCN-370b — A task reworded after the approval

- GIVEN the same approved change
- WHEN a task of tasks.md is reworded
- THEN the harness refuses the change as not approved: tasks

<!-- specgate:trace actor=Developer feature=features/change-lifecycle/REQ-370.feature kind=functional status=Implemented test=tests/unit/rc3-approvals.test.ts -->

### Requirement: REQ-371 — Approvals recorded by the first candidates keep counting

The system SHALL accept an approval whose recorded hash is of the layer's text as written — the form 1.0.0-rc.1 and rc.2 recorded — as long as that text has not changed.

#### Scenario: SCN-371a — A record written by 1.0.0-rc.2

- GIVEN an approval of tasks.md recorded with the hash of its text as written, a task already ticked
- WHEN its approvals are read
- THEN the tasks are approved

<!-- specgate:trace actor=Developer feature=features/change-lifecycle/REQ-371.feature kind=functional status=Implemented test=tests/unit/rc3-approvals.test.ts -->

### Requirement: REQ-380 — A dependency the design names is carried by a requirement

The system SHALL warn, when a layered change is validated, `layer_design_dependency_untraced` for each `depends=<repo>:REQ-NNN` that design.md names and that no `specgate:trace` of the change's delta carries, naming the requirement the design line associates it with when it names one, and saying to add it to that requirement's trace.

#### Scenario: SCN-380a — The panel's design names what it waits for

- GIVEN a layered change whose design.md has the row "REQ-002 — `depends=tracking:REQ-002`" and whose REQ-002 trace carries no depends
- WHEN `specgate change validate` runs
- THEN it warns layer_design_dependency_untraced for tracking:REQ-002, naming REQ-002

#### Scenario: SCN-380b — The dependency is in the trace

- GIVEN the same change, with `depends=tracking:REQ-002` in REQ-002's trace
- WHEN `specgate change validate` runs
- THEN it gives no layer_design_dependency_untraced warning

<!-- specgate:trace actor=Architect feature=features/change-lifecycle/REQ-380.feature kind=functional status=Implemented test=tests/unit/rc4-deps.test.ts -->

### Requirement: REQ-381 — An operation the design names is cited by a requirement

The system SHALL warn `layer_design_dependency_untraced` for each `api=<file>#<operation>` that design.md names and that no trace of the change's delta cites, and SHALL take neither a placeholder id (`REQ-NNN`) nor a placeholder file (`<file>`) for a reference.

#### Scenario: SCN-381a — An operation named only in the design

- GIVEN a layered change whose design.md names `api=contracts/fleet.yaml#listFleet` and the scaffold's `depends=contracts:REQ-NNN` and `api=<file>#<operationId>`
- WHEN `specgate change validate` runs
- THEN it warns once, for api=contracts/fleet.yaml#listFleet

<!-- specgate:trace actor=Architect feature=features/change-lifecycle/REQ-381.feature kind=functional status=Implemented test=tests/unit/rc4-deps.test.ts -->

### Requirement: REQ-390 — The design carries its dependencies into the traces

The system SHALL include, among the rules of `change instructions design` for a layered change (and so in the prompt of `change author design`), a rule saying that a `depends=<repo>:REQ-NNN` or `api=<file>#<operationId>` the design decides goes into that requirement's `specgate:trace` in the delta under `specs/`, naming `layer_design_dependency_untraced`.

#### Scenario: SCN-390a — The architect is told to carry a dependency into the trace

- GIVEN a layered change panel
- WHEN the architect runs `specgate change instructions design panel --json`
- THEN one of the rules names `depends=`, `api=`, the `specgate:trace` under `specs/` and `layer_design_dependency_untraced`

<!-- specgate:trace actor=Developer feature=features/change-lifecycle/REQ-390.feature kind=functional status=Implemented test=tests/unit/rc6-deps.test.ts -->

### Requirement: REQ-391 — A placeholder operation is no citation

The system SHALL NOT report `layer_design_dependency_untraced` for an `api=<file>#<operationId>` whose operation is a placeholder in angle brackets, even when the file is named.

#### Scenario: SCN-391a — An operation placeholder after a real file is no reference

- GIVEN the design of panel quotes `api=contracts/fleet-tracking.openapi.yaml#<operationId>`
- WHEN the developer runs `specgate change validate panel --json`
- THEN no `layer_design_dependency_untraced` is reported

<!-- specgate:trace actor=Developer feature=features/change-lifecycle/REQ-391.feature kind=functional status=Implemented test=tests/unit/rc6-deps.test.ts -->

### Requirement: REQ-416 — A rule citing a law names its source

The system SHALL tell whoever writes a layered change's specs that a `kind=business-rule` requirement citing a law, regulation, standard or contract carries a `Source:` line, with an example; and `change approve`, refusing a change with `approve_blocked`, SHALL give as its fix each blocker's own fix, prefixed with the requirement or item it is about.

#### Scenario: SCN-416a — A driving-time rule cites the regulation

- GIVEN contracts' change track-fleet has REQ-004, a business rule citing "the EU regulation on driving times" with no `Source:`
- WHEN the developer runs `specgate change instructions specs track-fleet --json` and `specgate change approve track-fleet --json`
- THEN the instructions show `Source: Regulation (EC) No 561/2006`, and approve is refused naming that REQ-004 names no source, with the fix `REQ-004: Add a "Source:" line`

<!-- specgate:trace actor=Developer feature=features/change-lifecycle/REQ-416.feature kind=functional status=Implemented test=tests/unit/rc10-contract.test.ts -->

### Requirement: REQ-564 — change show says whether the change may be built

The system SHALL include in `specgate change show <id> --json` the change's approvals as the harness judges them — whether they are required, whether the change is approved, when, and each layer's approvals and quorum — so a tool never takes `change.yaml`'s `approved:` line, which outlives an edit of an approved layer, for the answer.

#### Scenario: SCN-564a — A change just proposed

- GIVEN a change just proposed, with its three layers and no approval
- WHEN a tool runs `specgate change show <id> --json`
- THEN `change.approvals.approved` is false and `change.approvals.layers` lists discover, design and tasks

<!-- specgate:trace actor=Developer feature=features/change-lifecycle/REQ-564.feature kind=functional status=Implemented -->

### Requirement: REQ-567 — A 0.35 project reaches 1.0 in one command

The system SHALL, on a project 0.35 left — open changes without layers, the lanes under `roles:`, agent scripts that read `SPECGATE_ROLE` — name `specgate migrate 1.0` in `specgate status` (and in `status --json`'s `migrate`, with `config: true` when the harness config needs it, even with no open change to migrate); and `specgate migrate 1.0` SHALL layer the open changes keeping every other line of their `change.yaml`, rename the lanes, and list each tracked file that reads `SPECGATE_ROLE` among what a person must still do.

#### Scenario: SCN-567a — A 0.35 project, moved to 1.0 in one command

- GIVEN a committed 0.35 project with an open change of kind bug, `roles: [tester, implementer]` and scripts/agent.sh reading `SPECGATE_ROLE`
- WHEN a developer runs `specgate status`, then `specgate migrate 1.0`
- THEN status names the migration; afterwards the change is layered and still of kind bug, the harness config says `lanes:` and loads, the report names scripts/agent.sh, and status no longer names the migration

<!-- specgate:trace actor=Developer feature=features/change-lifecycle/REQ-567.feature kind=functional status=Implemented -->

### Requirement: REQ-619 — `change show --json` says what blocks approval before Approve is pressed

The system SHALL answer, in `change show <id> --json`, `change.blockers`: the blockers `change approve <id>` would refuse with as `approve_blocked` — each with its `code`, `message` and, when the rule gives them, its `fix` and `target` — and `[]` when nothing blocks the change; so that a client says what is left before the person presses Approve, and never parses the refusal's prose.

> Studio report (#538): a draft with six `D6_unlisted_value` findings was listed to review with an Approve button; the person pressed it and only then learned, from `approve_blocked`, that it could not be approved.

#### Scenario: SCN-619a — A change approve would refuse

- GIVEN a change whose question Q1 blocks REQ-001, which is not Needs Clarification
- WHEN a client runs `specgate change show <id> --json`
- THEN `change.blockers` lists `D7_floating_question` naming Q1 and REQ-001 with its fix, and every blocker's message is in the message `change approve` refuses with

#### Scenario: SCN-619b — A change nothing blocks

- GIVEN a change `change approve` would accept
- WHEN a client runs `specgate change show <id> --json`
- THEN `change.blockers` is `[]`

<!-- specgate:trace actor=Developer feature=features/change-lifecycle/REQ-619.feature kind=functional status=Implemented -->

### Requirement: REQ-628 — `change show --json` carries the change's use cases

The system SHALL answer, in `change show <id> --json`, `change.useCases`: the use cases the change's `use-cases.md` adds and modifies — each with its id, name, actor and requirements — and removes, each with its reason; and `null` when the change has no `use-cases.md`; so that a client shows them without reading the file.

#### Scenario: SCN-628a — A change's use cases shown

- GIVEN a change whose use-cases.md adds UC-004 "Create a child profile" for Tutor with REQ-001 and REQ-002, and removes UC-002 "Merged into UC-004"
- WHEN a client runs `specgate change show <id> --json`
- THEN `change.useCases` has UC-004 with its name, actor and requirements under added, nothing under modified, and UC-002 with its reason under removed; a change with no use-cases.md has `null`

<!-- specgate:trace actor=Developer feature=features/change-lifecycle/REQ-628.feature kind=functional status=Implemented -->

### Requirement: REQ-484 — A draft's review notes, as JSON

The system SHALL give, in `specgate change show <id> --json` and in the API's `change(dir, id)`, the change's review notes under `change.review`: for each request of its `review.md`, its id (`N1`, `N2`… in the file's order), its date, its text, the requirement it is about or null, its state — `open` or `addressed` — and the file and line it is written at; and, once addressed, the date it was addressed and what changed: for each requirement the redraft changed, its delta file, its line, and its text before and after.

#### Scenario: SCN-484a — One note addressed, one open

- GIVEN `draft-orders` whose review.md has N1 on REQ-001, addressed by a redraft that changed REQ-001's text, and N2 on no requirement, open
- WHEN a tool runs `specgate change show draft-orders --json` and calls `change(dir, "draft-orders")`
- THEN both answers are equal; N1 is `addressed`, with REQ-001's delta file, its line, and its text before and after the redraft; N2 is `open` with a null requirement

<!-- specgate:trace actor=Developer feature=features/change-lifecycle/REQ-484.feature kind=functional status=Implemented -->

### Requirement: REQ-485 — Drafting again hands the open notes to the agent

The system SHALL, when `specgate propose --from-brief <module> --agent <cmd>` drafts again a draft with open review notes, put in the agent's prompt each open note — its id, its requirement and its text — and no addressed one; SHALL say under `draft.notes` of its JSON which notes it gave, which it marked addressed and which are still open; and SHALL mark addressed, with the date and the text before and after, each note it gave whose requirement the agent changed — or, for a note on no requirement, whose draft the agent changed.

#### Scenario: SCN-485a — Two open notes, the agent changes one requirement

- GIVEN `draft-orders` with N1 on REQ-001 addressed, and N2 on REQ-001 and N3 on REQ-002 open
- WHEN `specgate propose --from-brief orders --agent <cmd> --json` runs and the agent changes REQ-001 only
- THEN the agent's prompt carries N2 and N3 and not N1; `draft.notes` gives N2 and N3 as given, N2 as addressed and N3 as open; and review.md marks N2 addressed with REQ-001 before and after

<!-- specgate:trace actor=Developer feature=features/change-lifecycle/REQ-485.feature kind=functional status=Implemented -->

### Requirement: REQ-634 — The use-case diagram and each use case's activity diagram are generated

The system SHALL generate, from `docs/specs/use-cases.md` and each `docs/specs/use-cases/UC-NNN.md`, `docs/specs/use-case-diagrams.md` — in Mermaid: each actor linked to the use cases it achieves inside the system, by id, and for each use case with a specification its activity, the main flow's steps in order from start to end, labelled with its scenarios, and each alternative branching at its step and ending — and `docs/specs/use-cases.puml`, the same diagrams in PlantUML; SHALL write them when `check` or `archive` regenerates the diagrams, the same bytes for the same sources; SHALL report `use_case_diagrams_stale` for a committed copy that differs; and SHALL draw nothing for a catalog holding only the template's row.

> #544: a use-case diagram with a live preview, and an activity diagram from the flows — generated so it never drifts from the catalog; Mermaid to render without a server, PlantUML for a team that draws with it.

#### Scenario: SCN-634a — The Mermaid diagrams

- GIVEN UC-002 and UC-004 for Tutor, and UC-004's specification with three steps and A1 at step 3 naming SCN-013
- WHEN specgate generates the diagrams
- THEN use-case-diagrams.md links Tutor to UC-002 and UC-004 in order, and UC-004's activity runs start → steps → end labelled SCN-012, with A1 branching from step 3 to the end

#### Scenario: SCN-634b — The PlantUML export

- GIVEN the same use cases and specification
- WHEN specgate generates the diagrams
- THEN use-cases.puml has the actor, the use cases inside System and their links, and UC-004's activity with A1 as a branch at step 3

#### Scenario: SCN-634c — Regenerated, and a hand edit reported

- GIVEN a project with UC-004 and its specification
- WHEN the diagrams are regenerated, and then use-cases.puml is edited by hand
- THEN both files are written once, nothing the second time, and `use_case_diagrams_stale` names use-cases.puml

<!-- specgate:trace actor=Developer feature=features/change-lifecycle/REQ-634.feature kind=functional status=Implemented -->

### Requirement: REQ-635 — `status --json` carries the use cases, their specifications and diagrams

The system SHALL answer, in `status --json`, `useCases`: the use-case diagram in Mermaid, and each use case of the catalog with its id, name, actor, requirements, its specification's file, the specification as read (REQ-631) and its activity in Mermaid — the last three null for a use case with no specification — and `null` for a project with no `docs/specs/use-cases.md`; so that a client shows them without reading the files.

#### Scenario: SCN-635a — The use cases in status

- GIVEN a project with UC-004 in the catalog and its specification naming SCN-012
- WHEN a client runs `specgate status --json`
- THEN `useCases.diagram` is a Mermaid flowchart, and UC-004 carries docs/specs/use-cases/UC-004.md, its main flow naming SCN-012 and its activity; with no catalog, `useCases` is null

<!-- specgate:trace actor=Developer feature=features/change-lifecycle/REQ-635.feature kind=functional status=Implemented -->

### Requirement: REQ-636 — `propose --use-cases` proposes the use cases of requirements delivered before the catalog

The system SHALL, on `specgate propose --use-cases` in a project with `docs/specs/use-cases.md`, open the change `use-cases-catalog` — `skip_specs`, a reserved `uc_range`, an empty `use-cases.md` and `USE-CASES.md` listing every requirement no use case of the catalog names or lists, with its scenarios, and how to write the use cases and their specifications — and, run again, say what is still missing: the faults REQ-625 and REQ-631 name and each requirement left out, or that it is ready to review; with `--agent <cmd>`, the project's agent SHALL write it first, confined to the change's folder. Approved and archived, it SHALL bring its use cases and specifications into the catalog; a use case of the catalog listing a requirement SHALL count as that requirement's use case for the gate (REQ-627). A project with every requirement in a use case SHALL be told so, and one with no catalog that it does not model use cases.

#### Scenario: SCN-636a — The change opened, and written by the agent

- GIVEN a project whose catalog holds only the template, and REQ-002 delivered with no use case
- WHEN the Developer runs `specgate propose --use-cases`, then with `--agent` an agent that writes UC-002 with REQ-002 and its specification, and a file outside the change
- THEN the change lists REQ-002 as uncovered and is not ready; after the agent it is ready, and the file outside it is undone

#### Scenario: SCN-636b — Approved and archived

- GIVEN the change with UC-002 and its specification written
- WHEN the Developer approves and archives it, and runs `specgate propose --use-cases` again
- THEN the catalog has UC-002 with REQ-002 and no template row, docs/specs/use-cases/UC-002.md exists, and every requirement is said to be in a use case

<!-- specgate:trace actor=Developer feature=features/change-lifecycle/REQ-636.feature kind=functional status=Implemented -->

### Requirement: REQ-631 — Each use case has a specification whose flows name the scenarios that prove them

The system SHALL read a use case's specification — `# UC-NNN — <name>`, `## Overview`, `## Actors`, `## Preconditions`, `## Main flow (SCN-…)` with numbered steps, `## Alternative flows` of `### A<n> — <what> (at step <n>) (SCN-…)` with numbered steps, `## Postconditions` and `## Business rules` naming requirements — and SHALL refuse, at archive, a change's `use-cases/UC-NNN.md` whose title is another id, that has no overview or no main flow with steps, a flow naming no scenario or one no requirement of the use case has, an alternative starting at a step the main flow lacks or with no steps, or a scenario of the use case's requirements no flow names; otherwise archive SHALL write it to `docs/specs/use-cases/UC-NNN.md`, and delete that file for a use case the change removes.

> #544, from AI Unified Process Studio: a use-case specification per use case — overview, preconditions, main success scenario, alternative flows, postconditions, business rules — here with every flow proved by a scenario.

#### Scenario: SCN-631a — A specification read

- GIVEN UC-004's specification with an overview, Tutor, a precondition, a main flow of three steps naming SCN-012, A1 at step 3 naming SCN-013, a postcondition and a rule naming REQ-014
- WHEN specgate reads it
- THEN it has each section, the two flows with their steps and scenarios, and nothing to fix when its requirements' scenarios are SCN-012 and SCN-013

#### Scenario: SCN-631b — A scenario no flow names

- GIVEN UC-004's A1 naming SCN-099, and its requirements' scenarios SCN-012 and SCN-013
- WHEN specgate checks it
- THEN it names SCN-099 as no scenario of UC-004 and SCN-013 as named by no flow

#### Scenario: SCN-631c — The specification archived

- GIVEN a change adding UC-007 with REQ-001, and its use-cases/UC-007.md whose main flow names SCN-001a
- WHEN the Developer archives it
- THEN docs/specs/use-cases/UC-007.md holds the specification

<!-- specgate:trace actor=Developer feature=features/change-lifecycle/REQ-631.feature kind=functional status=Implemented -->

### Requirement: REQ-632 — A draft writes each use case's specification

The system SHALL tell the agent, in `DRAFTING.md`, to write `use-cases/UC-NNN.md` for each use case it adds or modifies, with its sections and every flow naming its scenario; and SHALL keep a draft with `use-cases.md` from ready while such a use case has no specification (`D15_no_spec`) or its specification has the faults REQ-631 names (`D15_ucs_…`) — for a modified use case some requirement outside the draft delivers, only what the draft holds is checked.

#### Scenario: SCN-632a — The guide asks for it

- GIVEN a brief with the module bookings
- WHEN the Developer runs `specgate draft bookings`
- THEN DRAFTING.md has a section on use-cases/UC-NNN.md with a main flow naming a scenario and an alternative at a step

#### Scenario: SCN-632b — A draft held back by its specification

- GIVEN the bookings draft with UC-900 delivered by REQ-002 and its scenarios SCN-002 and SCN-003
- WHEN UC-900 has no specification, then one whose flows name only SCN-002
- THEN the draft is not ready with `D15_no_spec`, then with `D15_ucs_scenario_unflowed` naming SCN-003; with both named it is ready to review

<!-- specgate:trace actor=Developer feature=features/change-lifecycle/REQ-632.feature kind=functional status=Implemented -->

### Requirement: REQ-633 — The gate names a use case with no specification

The system SHALL report, under the gate rule `use_cases` (REQ-627), every use case of `docs/specs/use-cases.md` with no `docs/specs/use-cases/UC-NNN.md` (`use_case_no_spec`).

#### Scenario: SCN-633a — A use case with no specification

- GIVEN the catalog's UC-002 and UC-003, and a specification for UC-002 only
- WHEN the rule runs
- THEN it names UC-003 `use_case_no_spec`, and nothing once UC-003 has one

<!-- specgate:trace actor=Developer feature=features/change-lifecycle/REQ-633.feature kind=functional status=Implemented -->

### Requirement: REQ-625 — A change carries its use cases, and archive merges them into the catalog

The system SHALL read a change's `use-cases.md` — `## ADDED Use Cases` and `## MODIFIED Use Cases` tables of `| ID | Use Case | Actor | Requirements |`, and `## REMOVED Use Cases` of `| ID | Reason |` — and SHALL refuse to archive it when an id is no `UC-NNN` or repeats, an added id is in `docs/specs/use-cases.md` already, a modified or removed id is not, a use case has no name or no requirement, or a removed use case is still named by a requirement once the change is applied; otherwise archive SHALL merge it into `docs/specs/use-cases.md` — an added or modified row replacing the row with its id and keeping its command, aggregate and events, a removed id dropped, the template's placeholder row gone once a real use case is there — and list the catalog among its writes, `--dry-run` included. A change with no `use-cases.md` SHALL archive as before.

> #543: `init` wrote use-cases.md and AGENTS.md named it, and nothing ever filled it or checked it; 134 requirements of a project went through the gate with no use case.

#### Scenario: SCN-625a — A use case added

- GIVEN a change adding UC-007 "Price a session at peak time" for Driver with REQ-001, and a catalog holding the template's row and UC-002
- WHEN the Developer archives it
- THEN docs/specs/use-cases.md has UC-007 with REQ-001 and Approved, still UC-002, and no template row; the plan lists the catalog among its writes

#### Scenario: SCN-625b — A use case modified

- GIVEN UC-003 in the catalog with its command, aggregate and events, and a change modifying UC-003's name and requirements
- WHEN the change is archived
- THEN UC-003's row has its new name and requirements, and the same command, aggregate and events

#### Scenario: SCN-625c — A use case removed while a requirement names it

- GIVEN UC-002 named by REQ-000, and a change removing UC-002
- WHEN the Developer archives it
- THEN the archive is refused with `uc_removed_in_use` naming REQ-000, and the catalog is untouched

<!-- specgate:trace actor=Developer feature=features/change-lifecycle/REQ-625.feature kind=functional status=Implemented -->

### Requirement: REQ-626 — A draft carries its use cases, and every requirement names one

The system SHALL open a draft from a brief with `use-cases.md` and a reserved `uc_range` in `change.yaml` — as many use case ids as requirement ids, past every id the catalog, a change or another branch uses — and SHALL tell the agent, in `DRAFTING.md`, to write `uc=` in each requirement's trace and the use cases under `## ADDED Use Cases`; and SHALL keep a draft that has `use-cases.md` from ready while a requirement names no use case (`D14_no_use_case`), names one neither the change nor the catalog has (`D14_unknown_use_case`), or is listed by a use case it does not name (`D14_use_case_mismatch`), or while its use cases have the faults REQ-625 refuses. A draft opened with no `use-cases.md` SHALL be checked as before.

#### Scenario: SCN-626a — A draft opens with its use cases

- GIVEN a brief with the module bookings
- WHEN the Developer runs `specgate draft bookings`
- THEN the change has use-cases.md with an empty `## ADDED Use Cases` table, change.yaml has `uc_range`, and DRAFTING.md shows `uc=` with the first id and a section on use-cases.md

#### Scenario: SCN-626b — A requirement with no use case

- GIVEN the draft's REQ-002 with no `uc=`, and use-cases.md listing UC-900 with REQ-002
- WHEN the Developer checks the draft
- THEN it is not ready, with `D14_no_use_case` and `D14_use_case_mismatch`; with `uc=UC-901` it has `D14_unknown_use_case`; with `uc=UC-900` it is ready to review

<!-- specgate:trace actor=Developer feature=features/change-lifecycle/REQ-626.feature kind=functional status=Implemented -->

### Requirement: REQ-627 — The gate checks every requirement maps to a use case

The system SHALL have a gate rule `use_cases` — `warning` in the strict and standard presets and with no policy, `off` in minimal — which, in a project with `docs/specs/use-cases.md`, reports every requirement of the matrix whose Use Case is no `UC-NNN` (`use_case_missing`) or names one the catalog does not have (`use_case_unknown`), every use case no requirement delivers (`use_case_undelivered`), and the template's row left once there is a requirement (`use_case_template`); `REQ-000` and the adopted code's baseline are not asked for one. A project with no catalog SHALL get nothing from it.

#### Scenario: SCN-627a — Reported by default

- GIVEN a project with the template catalog and REQ-002 with no use case
- WHEN the Developer runs `specgate validate . --strict`
- THEN it passes, and reports `use_case_missing` for REQ-002

#### Scenario: SCN-627b — Failed when set to error

- GIVEN the same project with `use_cases: error` in .specgate/gate.yaml
- WHEN the Developer runs `specgate validate . --strict`
- THEN it fails with `use_case_missing` and `use_case_template`; with `use_cases: off` it says nothing of them

#### Scenario: SCN-627c — What the rule names

- GIVEN a matrix with REQ-002 naming no use case, REQ-003 naming UC-077 the catalog does not have, and UC-003 no requirement delivers
- WHEN the rule runs
- THEN it names REQ-002 `use_case_missing`, REQ-003 `use_case_unknown` and UC-003 `use_case_undelivered`

<!-- specgate:trace actor=Developer feature=features/change-lifecycle/REQ-627.feature kind=functional status=Implemented -->

### Requirement: REQ-599 — The design layer, by the change's rigor

The system SHALL judge whether design.md answers each acceptance criterion only once the design is written, and without the lines it shares with its template; SHALL, for a change at `rigor: full`, warn `layer_design_not_written` while design.md is as scaffolded and not count the change approved — so the harness does not build it — until its design is written and approved; and SHALL, at `rigor: lite`, treat an unwritten design as skipped, neither asking for it in status nor waiting for it.

#### Scenario: SCN-599a — The template answers nothing

- GIVEN a change whose Discover lists AC-1 and AC-2, and whose design.md is the template plus a line answering AC-2
- WHEN the change is validated
- THEN design.md is said not to answer AC-1, and AC-2 is answered

#### Scenario: SCN-599b — Lite: no design owed

- GIVEN a change at rigor lite whose design.md is as scaffolded
- WHEN the change is validated and its status read
- THEN no design finding is given, and the design is skipped

#### Scenario: SCN-599c — Full: the design is owed

- GIVEN a change at rigor full whose design.md is as scaffolded
- WHEN the change is validated and its approvals read
- THEN layer_design_not_written is given, and the change is not approved: its design is not written

<!-- specgate:trace actor=Developer feature=features/change-lifecycle/REQ-599.feature kind=functional status=Implemented -->

### Requirement: REQ-646 — status --json carries what an open change proposes, before archive

The system SHALL carry in `status --json`, besides the catalog's use cases, `useCases.proposed`: each use case an open change's `use-cases.md` adds or modifies — with its change, whether it is added or modified, its specification from the change's `use-cases/UC-NNN.md` and its activity, or none — and SHALL carry in `stateMachines` each machine an open change writes, as the change's delta leaves it, naming the change in `proposed` (null for a machine of `docs/specs/state-machines/`); an archived change proposes nothing.

> The Reviewer approved draft-cuenta-perfiles and saw "no use cases yet": archive brings them into the catalog only once every requirement is delivered.

#### Scenario: SCN-646a — Proposed before archive

- GIVEN a catalog with only the template, and the open change draft-cuenta-perfiles adding UC-002 with its specification and UC-003 without one, and writing Cuenta's machine
- WHEN the Developer runs `specgate status --json`
- THEN useCases.proposed lists UC-002 and UC-003 of draft-cuenta-perfiles as added, UC-002 with its specification's lanes and activity; stateMachines lists Cuenta proposed by draft-cuenta-perfiles

<!-- specgate:trace actor=Developer feature=features/change-lifecycle/REQ-646.feature kind=functional status=Implemented -->

### Requirement: REQ-637 — Each entity's state machine is read and checked against the requirements

The system SHALL read an entity's state machine from `docs/specs/state-machines/<Entity>.md` — `# <Entity> — states`; `## States` as `- <name> (initial|final) — <behaviour>`; `## Transitions` as a `From | To | Trigger | Requirement` table whose trigger is `event [guard] / action`; `## Forbidden` as `- <from> → <to> (REQ-NNN)` — and `validate --strict`, under the gate rule `state_machines` (error in the strict and standard presets, warning in minimal), SHALL fail a machine that lists no states, none or two initial states, a state twice, a transition or forbidden transition naming a state it lacks, a transition naming a requirement the matrix lacks, or a transition the machine forbids; and SHALL report, without failing, a state no transition from the initial one reaches, a state with no way out that is not final, and a transition that names no requirement.

> The Reviewer asked to see, as in Visual Paradigm, how a request moves from received to available, and that only what a requirement asks for be drawn.

#### Scenario: SCN-637a — A machine read

- GIVEN GenerationRequest with Received initial, Validating, Authorized, Available and Rejected final, four transitions naming REQ-011, REQ-046 and REQ-018, and Rejected → Available forbidden by REQ-034
- WHEN specgate reads it
- THEN it has the five states with their behaviour, the transitions with their requirements, the forbidden one, and nothing to fix

#### Scenario: SCN-637b — What a machine cannot hold

- GIVEN a transition into Availible naming REQ-099, and Rejected → Available as a transition
- WHEN specgate checks the machine
- THEN it names sm_unknown_state, sm_unknown_requirement and sm_forbidden_used as errors

#### Scenario: SCN-637c — What a machine is warned about

- GIVEN Expired final that no transition reaches, Rejected not final with no way out, and Authorized → Available naming no requirement
- WHEN specgate checks the machine
- THEN it warns sm_unreachable for Expired, sm_dead_end for Rejected and sm_transition_untraced

#### Scenario: SCN-637d — A machine that holds, at the gate

- GIVEN Order with Paid → Cancelled naming REQ-002 and Paid → Shipped naming none
- WHEN the Developer runs `specgate validate . --strict --json`
- THEN the gate passes and reports sm_transition_untraced

#### Scenario: SCN-637e — A machine that does not hold, at the gate

- GIVEN Order with Paid → Shipped naming REQ-404 and Shipped → Cancelled, which it forbids
- WHEN the Developer runs `specgate validate . --strict`
- THEN the gate fails naming sm_forbidden_used, sm_unknown_requirement and docs/specs/state-machines/Order.md; under the minimal preset it reports them and passes

<!-- specgate:trace actor=Developer feature=features/change-lifecycle/REQ-637.feature kind=functional status=Implemented -->

### Requirement: REQ-638 — A change's delta to a state machine is applied at archive

The system SHALL take a change's `state-machines/<Entity>.md` — `# Delta — <Entity>` with `## ADDED States`, `## MODIFIED States`, `## REMOVED States`, `## ADDED Transitions`, `## MODIFIED Transitions`, `## REMOVED Transitions`, `## ADDED Forbidden` and `## REMOVED Forbidden`, a transition known by its states and the words of its trigger before any guard or action — and, at archive, SHALL write the machine it leaves to `docs/specs/state-machines/<Entity>.md`, create it for an entity that had none, and delete it when no state is left; and SHALL refuse the change, writing nothing, when the delta adds a state or transition that exists, modifies or removes one that does not, removes a state a transition still uses, names a requirement neither the matrix nor the change has, or leaves a machine REQ-637 fails; a requirement no transition names any more SHALL be warned.

#### Scenario: SCN-638a — Added, modified, lifted

- GIVEN GenerationRequest and a delta adding Paused with Authorized → Paused and back, modifying Available and Authorized → Available, and removing the forbidden Rejected → Available
- WHEN the delta is applied
- THEN the machine has Paused and its two transitions, Available's new behaviour, Authorized → Available naming REQ-011 and REQ-018, no forbidden transition, and nothing to fix

#### Scenario: SCN-638b — What a delta cannot remove

- GIVEN a delta removing Rejected, which Validating → Rejected uses, and Expired and Received → Authorized, which do not exist
- WHEN specgate checks the delta
- THEN it names sm_state_in_use with Validating → Rejected, sm_state_unknown and sm_transition_unknown

#### Scenario: SCN-638c — A requirement left out

- GIVEN a delta removing Validating → Rejected, the only transition naming REQ-046
- WHEN specgate checks the delta
- THEN it warns sm_requirement_uncovered for REQ-046

#### Scenario: SCN-638d — Paused added to the machine at archive

- GIVEN a change adding REQ-050 and Paused with Validating → Paused and back naming REQ-050
- WHEN the Developer archives it
- THEN docs/specs/state-machines/GenerationRequest.md has Paused and its transitions, and keeps the others

#### Scenario: SCN-638e — Refused at archive

- GIVEN a change removing Rejected, which a transition uses, and adding a transition naming REQ-099
- WHEN the Developer archives it
- THEN archive refuses it with sm_state_in_use and sm_unknown_requirement, and the machine is unchanged

<!-- specgate:trace actor=Developer feature=features/change-lifecycle/REQ-638.feature kind=functional status=Implemented -->

### Requirement: REQ-639 — State machines reach PlantUML, the studio and the agent that drafts

The system SHALL write, at `check`, each machine's PlantUML beside it — `docs/specs/state-machines/<Entity>.puml`, its initial and final states, each transition labelled with its trigger and requirements, the forbidden ones in a «constraint» note — and report a copy edited by hand as `state_machine_diagram_stale`; SHALL carry the machines in `status --json` as `stateMachines` (null when there are none); SHALL tell the agent, in `DRAFTING.md`, to write an entity's machine as a delta when the brief describes its states; and SHALL keep a draft from ready while a machine it writes does not apply or does not hold (`D16_…`), its requirements being the draft's and the project's.

#### Scenario: SCN-639a — PlantUML of a machine

- GIVEN GenerationRequest
- WHEN specgate renders it
- THEN the PlantUML starts in Received, labels Validating → Authorized with `validate [safe]` and REQ-011, ends from Available, and notes Rejected → Available as forbidden

#### Scenario: SCN-639b — Written and carried

- GIVEN Order's machine
- WHEN the Developer runs `specgate check`, then `specgate status --json`
- THEN docs/specs/state-machines/Order.puml holds its transitions and status lists Order with its file, its PlantUML and its transitions

#### Scenario: SCN-639c — The guide asks for it

- GIVEN a brief with the module bookings
- WHEN the Developer runs `specgate draft bookings`
- THEN DRAFTING.md has "1d. An entity's states" with ADDED States, ADDED Transitions with their Requirement column, and ADDED Forbidden

#### Scenario: SCN-639d — A draft's machine checked

- GIVEN the draft of bookings writing Booking's machine with a transition into Confirmd naming REQ-404
- WHEN the Developer runs `specgate draft bookings`
- THEN it is not ready, naming D16_sm_unknown_requirement, then D16_sm_unknown_state; once corrected it is ready to review

<!-- specgate:trace actor=Developer feature=features/change-lifecycle/REQ-639.feature kind=functional status=Implemented -->

### Requirement: REQ-640 — Each step of a use case says who does it

The system SHALL read a step of a use case's specification written `<n>. [<Who>] <text>` as done by `<Who>`, and a step with no tag as done by the use case's first actor — its text without the tag — and SHALL refuse, wherever REQ-631 checks a specification (archive, and a draft's D15), a step done by someone not listed under `## Actors` (`ucs_unknown_lane`).

> The Reviewer chose, instead of BPMN, the use case's activity with a lane per actor, as UML tools draw it.

#### Scenario: SCN-640a — Lanes read

- GIVEN UC-007 with Child, PintaMundo and Safety service as actors, steps tagged [Child], untagged, [PintaMundo], [Safety service], [PintaMundo], and A1 tagged [PintaMundo]
- WHEN specgate reads it
- THEN the main flow's lanes are Child, Child, PintaMundo, Safety service and PintaMundo, A1's is PintaMundo, the steps keep no tag, and there is nothing to fix

#### Scenario: SCN-640b — A lane no actor names

- GIVEN the same specification with step 4 tagged [Moderator]
- WHEN specgate checks it
- THEN it names ucs_unknown_lane for Moderator

<!-- specgate:trace actor=Developer feature=features/change-lifecycle/REQ-640.feature kind=functional status=Implemented -->

### Requirement: REQ-641 — A use case's activity is drawn with a lane per actor

The system SHALL draw a use case's activity — in `docs/specs/use-case-diagrams.md` (Mermaid) and `docs/specs/use-cases.puml` (PlantUML) — with a lane per actor when its steps are done by more than one, each step inside its own lane, the flows and alternatives as before; and as before, with no lanes, when one actor does them all.

#### Scenario: SCN-641a — Lanes in Mermaid

- GIVEN UC-007's specification
- WHEN specgate draws its activity in Mermaid
- THEN it has a subgraph for Child holding steps 1 and 2, one for Safety service holding step 4, and one for PintaMundo holding A1's step

#### Scenario: SCN-641b — Lanes in PlantUML

- GIVEN UC-007's specification
- WHEN specgate writes its activity in PlantUML
- THEN it starts in |Child| and switches to |PintaMundo| and |Safety service| where the steps do, A1's step under |PintaMundo|

<!-- specgate:trace actor=Developer feature=features/change-lifecycle/REQ-641.feature kind=functional status=Implemented -->

### Requirement: REQ-642 — The lanes reach the agent that drafts and the studio

The system SHALL tell the agent, in `DRAFTING.md`, to start a step with `[Who]` when someone other than the first actor does it and to list everyone under Actors; and SHALL carry each flow's `lanes`, beside its steps, in `status --json`.

#### Scenario: SCN-642a — The guide asks for it

- GIVEN a brief with the module bookings
- WHEN the Developer runs `specgate draft bookings`
- THEN DRAFTING.md says to start a step with `[Who]`, its example has a step tagged [System] and System among the actors

#### Scenario: SCN-642b — Carried to the studio

- GIVEN UC-004 with Tutor and System, step 2 tagged [System]
- WHEN the Developer runs `specgate status --json`
- THEN its main flow's lanes are Tutor and System, its steps keep no tag, and its activity has System's lane

<!-- specgate:trace status=Implemented feature=features/change-lifecycle/REQ-642.feature artifact=scripts/draft/drafting-guide.ts actor=Developer kind=functional -->
