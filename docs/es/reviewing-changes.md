<!-- translation-of: d2d51e7a20ad -->
# Cambia un requisito ya entregado

Al final de esta página puedes añadir o cambiar requisitos en un proyecto vivo
mediante un **change**, para que los specs, los archivos feature y la matriz de
trazabilidad nunca se desincronicen. Un change es una carpeta bajo
`docs/specs/changes/<id>/` que guarda los requisitos que se añaden, modifican o eliminan hasta que se construyen.

**Necesitas:** un proyecto donde se haya ejecutado `specgate init`, y un comando de tests configurado (`specgate config set test_cmd "npm test"`).

El ciclo son cuatro comandos: `propose` abre el change, `apply` entrega cada
requisito, `status` dice lo que queda, y `archive` cierra el change cuando todos sus requisitos están entregados
([ADR-0035](specs/adr/0035-four-verbs-one-lifecycle.md)). Entre `propose`
y `apply`, una persona aprueba el change. Para escribir tus primeros requisitos en un proyecto nuevo, mira [Escribir specs](writing-specs.md).

<!-- specgate:diagram approval-loop -->

## 1. Abre el change

```bash
specgate propose add-dynamic-pricing --capability pricing
```

```
  ✔  Change add-dynamic-pricing created · lite · REQ ids REQ-014…REQ-016 reserved

    + docs/specs/changes/add-dynamic-pricing/change.yaml
    + docs/specs/changes/add-dynamic-pricing/discover.md
    + docs/specs/changes/add-dynamic-pricing/design.md
    + docs/specs/changes/add-dynamic-pricing/tasks.md
    + docs/specs/changes/add-dynamic-pricing/specs/pricing/spec.md

  Next ───────────────────────────────────────────────────
  ➜  specgate apply
     after you write the delta, a test that names each requirement, and the code
```

- **Las capas** ([ADR-0044](specs/adr/0044-the-three-layers-of-a-change.md)):
  `discover.md` es de producto (contexto, caso de uso, criterios `- AC-1: …`),
  `design.md` del arquitecto (nombra cada criterio), `tasks.md` del
  desarrollador (cada tarea nombra su `REQ-NNN`). `change validate` avisa de
  cada regla; el `proposal.md` de un change de la 0.27 es su Discover.
- **El delta** es `specs/<capability>/spec.md`: solo los requisitos que este
  change añade, modifica o elimina. Lleva el nombre del change salvo que
  `--capability` nombre la capacidad a la que pertenece.
- **Los ids reservados** se escriben en `change.yaml`, así que dos changes en
  curso nunca reparten el mismo `REQ-NNN`. `--reserve <n>` reserva más de tres.

## 2. Mira lo que queda

```bash
specgate status
```

`status` lista lo que queda por hacer, incluidos los requisitos de los changes
abiertos, y nombra el único comando que ejecutar después. Hasta que escribes el
delta, dice que el change aún no se juzga.

Para ver qué fichero del change escribir después, ejecuta `specgate change status add-dynamic-pricing`. Los ficheros de un change forman
un grafo de dependencias, no una secuencia de fases
([ADR-0018](specs/adr/0018-artifact-schemas.md)): nada te impide escribirlos
en otro orden.

## 3. Escribe el delta

Escribe solo lo que cambia, nunca una copia del spec entero:

```markdown
# Delta — pricing

## ADDED Requirements

### Requirement: REQ-014 — Dynamic peak pricing

The system SHALL raise the tariff automatically when occupancy crosses a
configured threshold.

#### Scenario: SCN-014 — Peak rate applies above the threshold

- GIVEN occupancy is above 85%
- WHEN a vehicle enters
- THEN the peak tariff is applied

<!-- specgate:trace kind=functional uc=UC-007 cmd=CMD-011 agg=AGG-Pricing
     evt=EVT-PriceApplied feature=features/pricing/REQ-014.feature -->
```

Hay tres secciones válidas: `## ADDED Requirements`, `## MODIFIED Requirements`
y `## REMOVED Requirements`. `MODIFIED` sustituye el bloque entero del
requisito; no fusiona escenario a escenario.

El validador es estricto con dos cosas:

- **Los pasos son viñetas simples `- GIVEN`.** `- **GIVEN**` falla con
  `scenario_not_gherkin`, porque la palabra clave tiene que empezar la línea.
- **El cuerpo necesita una palabra clave de obligación** (`SHALL`, `MUST`,
  `SHOULD` o `MAY`); si no, obtienes `no_rfc2119_keyword`.

El `kind=` del comentario `specgate:trace` (functional, non-functional o
business-rule) es obligatorio, y la plantilla que escribe `propose` no lo tiene:
añádelo, o `change approve` rechaza el change (`approve_blocked`; `change validate`
dice `change_not_approvable`). `uc`, `cmd`, `agg` y `evt` son columnas opcionales
de la matriz, `-` cuando faltan. `feature=` es un fichero por requisito.

Mientras el change está abierto, sus requisitos ya cuentan: `status` lista
REQ-014 como pendiente, y `apply`, `check` y `harness run` juzgan el proyecto
tal como quedará después de archive. Todavía no se escribe nada en
`docs/specs/capabilities/`.

**`depends=` dice sobre qué se apoya un requisito.** Añádelo al mismo comentario:

```markdown
<!-- specgate:trace kind=functional uc=UC-008
     feature=features/pricing/refunds.feature depends=REQ-014 -->
```

Separa varios con comas: `depends=REQ-014, REQ-016`. Entonces:

- **`specgate plan` ordena la cola** para que un requisito nunca vaya antes del
  trabajo que necesita, y marca como `⛔ blocked` uno cuya dependencia está
  pendiente, una vez archivado el change; mientras está abierto, los lista `status`.
- **`specgate validate` falla** con un ciclo (`requirement_cycle`), con una
  dependencia que no nombra ningún requisito (`unknown_dependency`) y con un
  requisito que depende de sí mismo (`self_dependency`).

Un proyecto que no declara ningún `depends=` no tiene dependencias.

## 4. Valida el delta

```bash
specgate change validate add-dynamic-pricing
```

```
  ✔ add-dynamic-pricing (1 delta(s))
```

Rara vez lo necesitas a mano: `specgate validate` y `specgate check` validan
cada change abierto, así que un delta roto hace fallar el gate por sí solo.

## 5. Apruébalo, y después aplica cada requisito

La revisión es el pull request del change: el delta, los tests que nombran sus
requisitos y el código, juntos. Empieza antes de que haya código: una persona
aprueba el change, y después cada requisito pasa por el gate por separado.

### Una persona aprueba el borrador

`specgate change approve <id>` registra que una persona lo leyó y lo aprobó, y
se niega mientras su checklist tenga un error o haya una pregunta abierta; `specgate
change note <id> "<what to change>" --req REQ-NNN` pide un cambio con tus
palabras, en el `review.md` del borrador. La sección Changes del [studio](studio.md) hace
las dos cosas, cada bloqueo con la acción que lo resuelve, y Build solo arranca borradores aprobados.

Cada capa la aprueba su propietario (ADR-0045): `--layer discover` producto,
`--layer design` el arquitecto, `--layer tasks` el desarrollador; sin
`--layer`, las capas que son tuyas. `harness.config.yaml` dice quién tiene cada
rol y cuántas personas necesita una capa: `roles: { product: [ana@acme.eu] }`,
`approvals: { quorum: { design: 2 }, required: layered }` (`layered` es el
valor por defecto; `always`, o `never` para el comportamiento de la 0.27). Un
rol para el que no se nombra a nadie queda abierto a cualquiera. Cada aprobación va al `approvals.json` del change.

- **Aprobar necesita una terminal.** `change approve` se niega cuando su
  entrada no es una terminal (`approve_needs_person`), y la herramienta de un
  agente no tiene. Una persona lo ejecuta en una terminal, o aprueba en Review
  del studio. `SPECGATE_ASSUME_TTY=1` existe para tests con scripts, no para agentes.
- **La aprobación sella los requisitos.** Cada requisito queda registrado por
  su hash. Uno que cambia después de la aprobación hace fallar el gate
  (`approved_requirement_changed`) hasta que una persona lo vuelve a aprobar;
  editar una capa también vuelve a pedir su aprobación.
- **El diseño fija el alcance.** Un fichero fuente nuevo que ningún diseño
  aprobado nombra se reporta (`file_outside_design`, regla del gate `scope`).

`apply` rechaza un requisito de un change que ninguna persona aprobó
(`change_not_approved`), y el harness se salta un change sin aprobar.

### Después, apply

```bash
specgate apply REQ-014
```

```
  ✖  REQ-014  REQ-014 has no test that names it yet (TDD-1).  [apply_no_test]
     fix: write a test that names REQ-014 (and its scenario SCN-014), then run specgate apply REQ-014
```

Escribe primero el test, nombrando el requisito (el enlace), después el código; vuelve a ejecutarlo:

```
  ✔  Specification   the gate, for REQ-014
  ✔  REQ-014 → Implemented (1 row updated)
```

El gate es el mismo que el de `check`: `validate --strict` para el requisito,
tu check de arquitectura (`arch_cmd`) y tus tests (`test_cmd`). No se escribe
nada mientras falla. El estado va al delta del change
(`<!-- specgate:trace status=Implemented -->`). Sin id, `apply` toma el
siguiente requisito que nombra `status`. `apply` no commitea: commitea después.

### Tests de aceptación sellados

Un change también puede llevar tests de aceptación escritos por alguien
distinto del agente que implementa, aprobados por una persona y sellados, para
que el agente no pueda cambiarlos: [Tests de aceptación sellados](sealed-acceptance.md).

## 6. Archívalo

Archiva cuando todos los requisitos que el change añade o modifica estén
Implemented, en tu rama, antes de abrir el pull request. Antes se niega, y
`--force` no se salta esto:

```
  ✖  add-dynamic-pricing  Change 'add-dynamic-pricing' has 1 requirement(s) not delivered yet: REQ-014.  [archive_requirements_pending]
     fix: specgate apply REQ-014
```

Primero previsualiza:

```bash
specgate archive add-dynamic-pricing --dry-run
```

```
  Archive plan ───────────────────────────────────────────
    ~ docs/specs/capabilities/pricing/spec.md   spec
    ~ docs/specs/traceability.md   traceability
    → docs/specs/changes/add-dynamic-pricing moves to docs/specs/changes/archive/2026-10-19-add-dynamic-pricing
```

No hay archivo feature en el plan: lo escribió `change approve`. Las tareas sin
marcar en `tasks.md` son un aviso (`archive_tasks_incomplete`); `--force`
archiva igualmente, una vez entregados todos los requisitos. Después:

```bash
specgate archive add-dynamic-pricing
```

```
  ✔  Archived as 2026-10-19-add-dynamic-pricing

    Specs         1 added · 0 modified · 0 removed
    Traceability  1 row(s) added · 0 updated · 0 removed
    Features      0 materialised
```

`Features 0 materialised` es lo esperado, por la misma razón. El delta se
integra en `docs/specs/capabilities/pricing/spec.md`; la fila llega entregada:

```
| REQ-014 | SCN-014 | `features/pricing/REQ-014.feature` | UC-007 | CMD-011 | AGG-Pricing | EVT-PriceApplied | - | test/pricing.test.js | Implemented |
```

El spec y su código llegan a revisión en un solo pull request, después de que
pase el gate; un test que contradice el texto del spec se corrige en el mismo change.

### Cuando el change modifica un requisito ya entregado

Un requisito `MODIFIED` vuelve a estar pendiente mientras el change está
abierto: `status` lo lista como necesitado de un test para sus escenarios
nuevos, y `archive` lo espera como a cualquier otro. Cuando se entrega, con
`apply` o con el harness, su test debería nombrar cada uno de sus escenarios:
un aviso con el preset standard (regla `coverage`), un error con el strict. Dos
requisitos modificados por el mismo change se entregan de uno en uno; ninguno
espera al otro. Archivar reescribe entonces el archivo feature a partir del delta
(`archive_feature_regenerated`).

Si el archivo feature contiene escenarios que no están en el delta (escritos a
mano, o eliminados por el change), archivar no lo toca y dice qué escenarios le
faltan (`archive_feature_stale`).

### Con packs de dominio

La actualización de un pack upstream se puede revisar como un change (`specops diff --as-change
--pack-version v0.2.0`), un change local se puede devolver al pack (`specops
contribute --change <id>`), y la deriva respecto al pack instalado hace fallar CI
(`validate --against-lock`): [Packs de dominio](domain-packs.md).

## Haz que un agente redacte un fichero

`specgate change author` hace que un agente escriba un fichero de un change —la
propuesta o el delta— confinado a la carpeta del change:

```bash
specgate change author add-dynamic-pricing --artifact specs --agent "claude -p < {prompt_file}"
```

El prompt es `specgate change instructions` preparado para un agente: la misma
plantilla, las mismas reglas y los mismos ids reservados que recibe una persona
(perfiles: [Elegir y conectar tu agente](agent-setup.md)). Cualquier cosa escrita
fuera de `docs/specs/changes/<id>/` se deshace; se niega con un árbol sucio, así
que commitea primero; `--dry-run` imprime el prompt y no escribe nada. Para
redactar a partir de un brief o de un ticket: [A partir del brief de un cliente](from-a-brief.md) ·
[A partir de un ticket de Jira](from-a-ticket.md).

## Siguiente

- [Validar](validating.md)
- [El harness](harness.md)
