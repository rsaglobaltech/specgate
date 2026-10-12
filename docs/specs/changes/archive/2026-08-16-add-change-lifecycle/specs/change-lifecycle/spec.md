# Delta — change-lifecycle

## Purpose

Propose, review and archive a change to the specification as a reviewable unit
of intent.

## ADDED Requirements

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
