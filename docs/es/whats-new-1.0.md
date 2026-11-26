<!-- translation-of: cadb2b6212f3 -->
# Novedades de 1.0

Specgate 1.0 es para un producto hecho de varios repositorios y construido por
varios roles. 1.0.0 está publicada —`npm install` la instala— tras doce
candidatas (`1.0.0-rc.1` a `rc.12`), cada una publicada con el dist-tag `next`.

```bash
npm i -D @rsaglobaltech/specgate@1
npx specgate --version                 # 1.0.0
```

Un proyecto 0.x se mueve con un comando, `specgate migrate 1.0`: qué se rompe,
qué hace con cada cosa y cómo quedarse en 0.35 está en
[Migrar a 1.0](migrating-to-1.0.md). Esta página muestra lo que añade 1.0,
funcionalidad a funcionalidad, y después lo que cambió cada candidata.

## Un change en tres capas, cada una con su dueño

Un change de 0.x era una propuesta y un delta. Un change de 1.0 tiene tres
capas, cada una escrita y aprobada por el rol que es su dueño
([ADR-0044](specs/adr/0044-the-three-layers-of-a-change.md)):

| Capa | Archivo | Dueño | Dice |
|---|---|---|---|
| Discover | `discover.md` | producto | contexto, caso de uso, criterios de aceptación `- AC-1: …`, sin tecnología |
| Design | `design.md` | arquitectura | módulos, mecanismos, decisiones; responde a cada criterio |
| Tasks | `tasks.md` | desarrollo | tareas verificables, cada una nombrando su requisito |

El delta bajo `specs/` sigue siendo el contrato que juzga el gate.

```bash
specgate change new follow-shipment          # writes the three layers
specgate change status follow-shipment       # "Write discover.md (product)" …
specgate change validate follow-shipment     # the layer rules, below
```

`change validate` avisa cuando el Discover nombra una tecnología, cuando el
diseño deja un criterio sin responder, cuando una tarea no nombra ningún
requisito y cuando el Discover se alejó de la versión acordada; `--strict`
falla con ellos. También falla con `change_not_approvable` con cualquier cosa
que la aprobación rechazaría.

`specgate change author <id> --artifact discover|specs|design|tasks` hace que
un agente escriba una capa, con las reglas de esa capa y, en un workspace, la
historia completa en su prompt.

## Los roles y las aprobaciones controlan el harness

`roles:` en `harness.config.yaml` nombra quién tiene cada rol, y cada capa la
aprueba su dueño ([ADR-0045](specs/adr/0045-roles-approvals-and-role-packages.md)):

```bash
specgate change approve follow-shipment --layer discover   # product
specgate change approve follow-shipment --layer design     # architect
specgate change approve follow-shipment --layer tasks      # developer
```

Cada aprobación se guarda en el `approvals.json` del change con un hash de la
capa. Editar una capa aprobada vuelve a pedir su aprobación; marcar la casilla
de una tarea no. El harness construye un change con capas solo cuando todas las
capas escritas están aprobadas (si no, `harness_not_approved`);
`approvals: { required: never }` mantiene el comportamiento de 0.x. Changes en
el studio muestra las aprobaciones de cada capa y deja que quien la ve apruebe
la capa de la que es dueño; en el studio de un equipo, como la persona que ha
iniciado sesión.

**Paquetes de rol.** `harness/<role>.md`, con `applies-to` por tipo, capacidad
o etiqueta, llega al prompt de los requisitos a los que afecta bajo «Role
constraints», y el registro de la ejecución, la vista en vivo y
`harness report` lo nombran como `role@version`.

## Un workspace de repositorios

Un **repositorio workspace** contiene `specgate.workspace.yaml`, que nombra los
repositorios de un producto y sus roles —`service`, `web`, `contracts`—
([Workspace](workspace.md), [ADR-0043](specs/adr/0043-the-workspace.md)).

```bash
specgate workspace init --name truck-flote     # finds the sibling repositories
specgate workspace status                      # where the product stands
specgate workspace check                       # every repository's gate at once
```

En todo el workspace un requisito se nombra con su repositorio,
`tracking:REQ-012`, y un requisito que necesita el de otro repositorio lo dice
en su trace:

```markdown
<!-- specgate:trace kind=functional actor=Dispatcher depends=contracts:REQ-002 api=contracts/fleet.openapi.yaml#getFleetStatus -->
```

`workspace check` retiene un requisito hasta que se entrega aquel del que
depende (`workspace_dependency_pending`). Mientras el propio requisito sigue en
un change abierto, ese es el orden en que se construye la historia, así que es
un aviso.

## Una historia de negocio, del brief del cliente a cada repositorio

El brief es del cliente; la historia es del negocio; cada repositorio recibe
su parte.

```bash
specgate workspace draft                        # brief.md, below a front matter naming its stories
specgate workspace draft --agent "claude -p"    # an agent proposes the stories
specgate workspace draft track-fleet --agent "claude -p"   # intent and criteria of one story
specgate workspace propose track-fleet          # a change in each repository it touches
```

- El `## Repositories` de una historia dice qué criterios responde cada
  repositorio (`- tracking: AC-1, AC-2`); `workspace check` avisa de un
  criterio que nadie responde o que reclaman dos, y cuando los criterios de un
  repositorio se desvían de los de la historia.
- Las preguntas de la historia esperan en `docs/stories/<id>/questions.md`;
  `workspace propose` se niega mientras haya una abierta.
- Cada sub-change recibe la intención y los criterios de la historia en su
  `discover.md`, y un `story.json` que nombra el workspace, así que el agente
  que escribe cualquiera de sus capas ve la historia completa y las partes de
  los demás repositorios.
- La historia está hecha cuando cada parte está archivada; su coste las cuenta todas.

## Primero los contratos, luego los servicios que los usan

Un repositorio con el rol `contracts` escribe los archivos OpenAPI o AsyncAPI
bajo `contracts/`, y cada uno de sus requisitos cita su operación con
`api=contracts/<file>#<operationId>`. Los demás repositorios los citan:

- `change validate` avisa `layer_no_contract_cited` para un requisito de una
  historia que comparte un criterio con los contratos y no cita ninguno de sus
  requisitos u operaciones, y `layer_design_dependency_untraced` para un
  `depends=` o `api=` que decide design.md y que ningún trace lleva: el
  harness lee los traces.
- `change author` escribe una parte que comparte un criterio con los contratos
  solo después de que la parte de los contratos especifique algo
  (`author_contracts_first`; `--force` la escribe igualmente).
- `validate` falla cuando un `api=` de un requisito entregado no se resuelve;
  un requisito aún no construido puede citar un contrato que escribirá.
- Un requisito de servicio o web cita la operación que sirve o llama, con el
  nombre del repositorio de contratos delante del archivo:
  `api=contracts:contracts/fleet.openapi.yaml#getFleetStatus`. `workspace check`
  lo resuelve allí. El contexto de la historia lista la línea exacta que copiar
  para cada operación, y `change approve` rechaza una parte cuyo `api=` no
  nombra ninguna de las operaciones de los contratos (`layer_api_unresolved`)
  o que no nombra ninguna donde los contratos citan una (`layer_no_operation_cited`).
- El prompt del harness cita cada operación citada tal como la escribe el
  contrato: sirve o llama exactamente ese método y esa ruta.
- `specgate contract check` lista las operaciones que ningún requisito cita, y
  con `workspace check` avisa `contract_operation_not_found` cuando el código de
  un requisito entregado ni sirve ni llama la ruta de la operación. En el
  harness eso es un intento fallido: el código sirve o llama la operación que
  cita, entera o por partes, o el requisito no pasa.

## La historia, construida en orden

```bash
specgate workspace harness run --story track-fleet --dry-run   # the levels
specgate workspace harness run --story track-fleet
```

El harness de cada repositorio arranca para su parte, por niveles: una parte
que depende de requisitos de otro repositorio arranca cuando ese repositorio
los ha entregado. Ninguno arranca cuando la base de un repositorio ya falla el
gate. En la sexta y séptima ejecuciones de truck-flote —tres repositorios,
nueve requisitos— los contratos se construyeron en el nivel 1 y el servicio y
la web en el nivel 2, cada requisito al primer intento.

## El workspace, en vivo

`specgate studio` en el repositorio workspace abre su Live sobre el workspace,
actualizado según ocurre: un panel por repositorio con el requisito en curso, su paso del gate y
el último paso del agente; cada historia con sus partes abiertas, en
construcción, archivadas o ausentes, y nombradas las partes que esperan a otro
repositorio; el coste por repositorio y por historia. Cada repositorio lleva a
su propio Live en `/live/repo/<name>/`. `specgate workspace live --json`
imprime el mismo modelo.

## El backlog sigue al change

`alm sync` mueve la incidencia de cada change al estado de su fase
—`proposed`, `building`, `archived`— en Jira, Azure Boards, GitHub y, nuevo en
1.0, Linear. `alm pull` trae los comentarios de la incidencia como notas en
`review.md`, nunca a la especificación, y un change que lista `repositories:`
recibe una sub-incidencia por repositorio. `alm phase` y `alm move` dicen en
qué punto está un change y mueven su incidencia ahora
([El tablero sigue al change](alm-phases.md)).

## Las dos brechas

`harness report` dice, para cada requisito que necesitó retrabajo, si el spec
era claro y el código divergió (spec → implementación) o si el spec omitió
parte del caso de uso (intención → spec), y qué reforzar. Una persona lo confirma:

```bash
specgate harness report --classify REQ-012 --gap intent-spec --reason "the criterion did not say offline"
```

Ver [Informe del harness](harness-report.md).

## Principios, deriva y un alcance para adoptar

- **Principios.** `docs/specs/principles.md`, desde un archivo o un domain
  pack, con su versión; un principio con `run=` o `forbid=` … `in=` lo
  comprueba el gate (`principle_failed`), y `principles_behind` dice cuándo se movió la fuente.
- **Deriva.** `check` avisa `spec_drift` para un commit que cambia código de
  producción y no nombra ningún requisito; `specgate drift` lo informa para CI.
- **Adopta una zona.** `specgate adopt --scope <path>` especifica una parte de
  un repositorio grande.

## Cada candidata

Cada candidata después de la primera salió de una ejecución de truck-flote
—un producto de tres repositorios construido solo a partir del brief de su
cliente— y corrige lo que encontró esa ejecución. Las notas completas están en el
[CHANGELOG](https://github.com/rsaglobaltech/specgate/blob/main/CHANGELOG.md).

| Candidata | Qué cambió |
|---|---|
| 1.0.0-rc.1 | La línea: tres capas, roles y aprobaciones, el workspace y su vista en vivo, el backlog siguiendo las fases, las dos brechas, principios, deriva, contratos de API, `specgate migrate 1.0`. Una candidata nunca es `latest`. |
| 1.0.0-rc.2 | El workspace toma el brief del cliente y redacta sus historias; la intención y los criterios de una historia llegan a cada repositorio; la historia se construye en orden de dependencias; `init --yes` adopta la carpeta en la que se ejecuta. |
| 1.0.0-rc.3 | Marcar una casilla ya no retira una aprobación; un agente propone las historias; cada criterio nombra sus repositorios; las preguntas esperan sus respuestas; los agentes ven la historia completa. |
| 1.0.0-rc.4 | Lo que un diseño dice que un requisito espera llega a su trace; el repositorio de contratos escribe sus contratos; un agente puede marcar su propia tarea. |
| 1.0.0-rc.5 | Un contrato se construye requisito a requisito; una parte que comparte un criterio con los contratos los cita. |
| 1.0.0-rc.6 | El diseño lleva sus dependencias a los traces, así que las partes se construyen en orden; una operación placeholder no es una cita. |
| 1.0.0-rc.7 | Una parte se escribe después de los contratos que usa; un requisito aún en redacción que espera a otro repositorio es el orden de construcción, no un fallo. |
| 1.0.0-rc.8 | El sitio lleva ambas versiones: esta página, y el selector arriba a la izquierda. Menos pipelines y más claros: un CI, una publicación, un workflow programado. |
| 1.0.0-rc.9 | Una parte cita la operación del contrato (`api=contracts:<file>#<operationId>`), su agente lee la operación y su código se comprueba frente a ella (`contract_operation_not_found`); la vista en vivo del workspace abre la de cada repositorio en `/live/repo/<name>/`; Node.js 24. |
| 1.0.0-rc.10 | Una parte cita la operación de los contratos tal como la lista la historia, o la aprobación la rechaza (`layer_api_unresolved`); el harness hace fallar un requisito cuyo código no sirve ni llama ninguna ruta de la operación; una regla que cita una ley nombra su fuente; un intento vacío después de uno escrito se reintenta una vez. |
| 1.0.0-rc.11 | `workspace check` juzga el código de una parte como lo hace el harness: una ruta montada por partes cuenta, y al repositorio de contratos no se le pide servir sus propias operaciones. |
| 1.0.0-rc.12 | Todo lo que añadieron 0.28 a 0.35, en la línea 1.0: `reverse`, ADRs y derechos de decisión, el glosario y las reglas numeradas, revisión, aceptación y notas de versión leyendo el Discover, el studio rediseñado aprobando capa a capa y mostrando el workspace, `sgate`. Las sesiones de tester e implementador son `lanes:`. Los workflows de publicación vuelven a ser los de 0.35. |
| 1.0.0 | El build que era 1.0.0-rc.12, como `latest`: desde aquí nada en lo que se apoya un usuario se elimina dentro de 1.x (`contract/surface.json`, [compatibilidad](compatibility.md)), y un proyecto que escribe 1.0.0 lo lee cada build posterior (`tests/compat/1.0.0/`). |
