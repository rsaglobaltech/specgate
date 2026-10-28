# Change Lifecycle

## Purpose

Propose, review and archive a change to the specification as a reviewable unit
of intent.

## Requirements

### Requirement: REQ-100 — A change is a reviewable folder

El sistema SHALL representar un cambio propuesto como un directorio bajo
`docs/specs/changes/<change-id>/` que contiene la propuesta, las tareas y los
deltas de especificación que el cambio introduce.

#### Scenario: SCN-100a — Crear un cambio

- GIVEN un proyecto spec-driven sin cambios activos
- WHEN el usuario ejecuta `specgate change new add-dynamic-pricing`
- THEN se crea el directorio del cambio con `proposal.md`, `tasks.md` y `change.yaml`
- AND se reserva un rango de identificadores REQ que ningún otro cambio puede usar

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
