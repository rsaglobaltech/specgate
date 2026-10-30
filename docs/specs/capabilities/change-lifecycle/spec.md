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
