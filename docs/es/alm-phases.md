<!-- translation-of: 02a014f93211 -->
# El tablero sigue al change

Un ticket del tablero se mueve según se mueve su change, lo que producto
escribe en el ticket vuelve al change, y un change que abarca varios
repositorios recibe una sub-incidencia por repositorio. El spec sigue siendo el
contrato ([ADR-0021](specs/adr/0021-alm-is-a-mirror.md)): al tablero se le dice
en qué punto está un change, y nunca lo decide.

## Qué ticket

Un change está en el tablero cuando su `change.yaml` nombra un ticket:
`ticket: FLEET-12` (escrito por `specgate propose --from-ticket`) u
`origin: alm:FLEET-12` (escrito por `specgate alm pull`). Un proyecto cuyos
tickets son la fuente pone `mirror: false` en `alm.config.yaml`, para que
`alm sync` no cree además una incidencia por requisito.

## Las fases

| Fase | Cuándo | Jira | Azure Boards | GitHub | Linear |
| --- | --- | --- | --- | --- | --- |
| `proposed` | el change está abierto y no hay nada construido | un estado «To Do» | `New` | etiqueta `specgate:proposed` | un estado no empezado |
| `building` | uno de sus requisitos tiene una rama `harness/REQ-NNN`, o está Implemented | un estado «In Progress» | `Active` | etiqueta `specgate:building` | un estado empezado |
| `archived` | `specgate archive` lo movió | un estado «Done» | `done_state` (`Done`) | cerrada, completed | un estado completado |

Un tablero con sus propias palabras las nombra:

```yaml
phases:
  proposed: Backlog
  building: Doing
  archived: Shipped
```

`specgate alm sync` mueve el ticket de cada change a su fase. Lo que le dijo al
tablero se guarda en `.specops/alm-phases.json` (haz commit de él): un
movimiento ya hecho no se vuelve a hacer, así que ejecutarlo en cada merge
cuesta una petición por cada change que se movió. `--dry-run` imprime
`would-move alerts FLEET-12 → Doing` y no envía nada.

## Lo que gana el ticket

`specgate alm pull` trae, para cada change abierto con ticket, los comentarios
que no había traído antes y —cuando la descripción cambió desde el último
pull— una nota que lo dice con el texto nuevo. Llegan al `review.md` del
change, las mismas filas que `specgate change note`, para que una persona las
incorpore a la propuesta o al delta. No se reescribe nada. El primer pull de un
ticket registra su descripción y vuelve con sus comentarios. Los comentarios de
Azure Boards son una API en preview y no se leen; el pull lo dice.

## Una sub-incidencia por repositorio

Un change que abarca varios repositorios los lista:

```yaml
ticket: FLEET-20
repositories: [fleet, tracking, web]
```

`alm sync` crea una sub-incidencia de FLEET-20 por repositorio
—`FLEET-20 — tracking: follow-shipment`— y la registra, para que ninguna se
cree dos veces: una sub-task de Jira (`subtask_type`, «Sub-task» por defecto),
un work item hijo de Azure Boards, una sub-issue de GitHub, una sub-issue de Linear.

## Para un agente

```bash
specgate alm phase alerts --json      # {"phase": {"phase": "building", "ticket": "FLEET-12", "state": null, …}}
specgate alm move alerts --json       # moves FLEET-12 to the building state now
specgate alm move alerts archived     # or to the phase named
```

`alm phase` lee el repositorio y `.specops/alm-phases.json`, nunca la red.
Ambos son herramientas MCP: `specgate_alm_phase` y `specgate_alm_move`
([MCP](mcp.md)).

## Linear

```yaml
alm_version: 1
provider: linear
team_key: ENG
token_env: LINEAR_API_KEY
```

La clave es una API key personal, enviada en `Authorization` como espera Linear
y nunca escrita en el archivo. Las incidencias se identifican por su
identificador (`ENG-123`); una incidencia cancelada cuenta como abierta, ya que
nadie la entregó.

## Siguiente

- [Jira, Azure Boards, GitHub y Linear](alm.md)
- [Desde un ticket de Jira](from-a-ticket.md)
