# Specgate a escala de empresa: qué falta (línea 1.0)

Estado a **0.27.9** (2026-10-29). Compara el artículo de InfoQ
*Spec-Driven Development at Enterprise Scale* con lo que Specgate hace hoy, y
propone lo que falta como la línea **1.0**: cambios que rompen el formato o el
flujo de 0.27, desarrollados en la rama `next/1.0` y publicados como
`1.0.0-rc.N`, sin tocar `main` hasta la versión final.

## La tesis del artículo, en una línea

El desarrollo guiado por especificación en una empresa es un cambio de
organización, no una herramienta: el spec es a la vez la conversación entre
producto, arquitectura, desarrollo y calidad, y el contexto de los agentes.
Adoptar el flujo sin cambiar cómo colaboran es "SpecFall".

## Resumen

| # | Qué pide el artículo | Estado en Specgate | Qué falta | ¿Rompe 0.27? |
| --- | --- | --- | --- | --- |
| 1 | Varios repositorios | **No existe** | Workspace, historia partida en sub-issues por repo, gate coordinado, vista de cartera | **Sí**: ids de requisito por repo |
| 2 | Discover → Design → Tasks | **Parcial** | Spec de diseño del arquitecto; historia de negocio estable | **Sí**: formato del change |
| 3 | Harness por rol | **Parcial** | Paquetes de restricciones con dueño (seguridad, rendimiento, infra) que se suman al prompt | Sí: `harness.config.yaml` v2 |
| 4 | Backlog que sigue las fases | **Parcial** | Estados del tablero por fase, en los dos sentidos; sub-issues; Linear | No |
| 5 | Quién aporta, revisa y aprueba | **Parcial** | Aprobación por rol, quórum, registro de firmas | **Sí**: aprobación obligatoria por defecto |
| 6 | Medir los dos huecos | **No existe** | Clasificar fallos: intención → spec y spec → implementación | No |
| 7 | Steering de la organización | **Parcial** | Principios heredados por cada repo, versionados y comprobados | No |
| 8 | Deriva por editar el código | **Parcial** | Detectar comportamiento cambiado sin cambio de spec | Sí, si es gate por defecto |
| 9 | Estilos de spec | **Parcial** | OpenAPI/AsyncAPI de primera clase; contratos desde requisitos | No |
| 10 | Brownfield grande | **Parcial** | `adopt` acotado a una zona; aviso de spec demasiado grande | No |

## Lo que Specgate ya cubre

- **Producto sin Git:** el studio (Inicio, Preguntas, Revisión, Construir; ES/EN)
  es justo lo que el artículo pide para que producto participe sin flujos de Git.
- **Integrar el backlog, no cambiarlo:** Jira, Azure Boards y GitHub como fuente
  (`propose --from-ticket`, con Definition of Ready) o como espejo
  (`alm sync`/`pull`) — [alm.md](../alm.md), ADR-0021.
- **Brownfield incremental:** `adopt`, REQ-001 "preservar el comportamiento", un
  change por zona que se toca.
- **Todo pasa por el spec:** el gate, `done` que se niega, el write-scope del
  harness, AGENTS.md.
- **Vista de arriba:** `spec.md` por capability, la matriz, el informe del studio.
- **Specs revisables:** reglas D1–D12, máximo 8 módulos, límite de 25 requisitos.
- **Spec ↔ implementación:** Gherkin, tests que nombran el requisito, TDD estricto,
  cobertura del diff, mutación.
- **Harness de arquitectura y seguridad:** `arch_cmd`/`arch_sarif`, los checks de
  calidad ([quality.md](../quality.md)).
- **Reutilizar entre repos:** domain packs, packs `contracts` con OpenAPI.
- **Extender antes que crear:** compatible con OpenSpec ([openspec.md](../openspec.md)).

## 1. Varios repositorios

**El hueco más grande.** El artículo: la suposición de un solo repo falla con
microservicios, librerías compartidas y repos de infraestructura.

**Hoy:** un repo, un `spec.md`, un gate. Los packs comparten especificación, no
coordinan una entrega.

**Falta**
- **Workspace:** un `specgate.workspace.yaml` que nombra los repos de un producto
  (ruta local o URL) y sus capabilities.
- **Ids sin colisión:** `REQ-012` existe en cada repo. Hace falta un id calificado
  (`billing:REQ-012`) o un espacio por workspace. **Rompe** la forma de los ids en
  la matriz, los tests y los commits.
- **Una historia, varios repos:** un change del workspace (la historia de negocio)
  que se parte en sub-changes por repo, cada uno con su gate, y un estado
  agregado: la historia está hecha cuando lo están todos.
- **Contratos entre repos:** un requisito del repo A que depende de una API del
  repo B, comprobado contra el contrato publicado (pack `contracts`).
- **Vista de cartera:** studio y `status --workspace` con N repos: hechos, en
  curso, bloqueados, coste del harness.

## 2. Discover → Design → Tasks

**Hoy:** el brief (Discover), y por change `proposal.md`, `tasks.md` y el delta. El
requisito mezcla el qué de negocio y el cómo técnico.

**Falta**
- **Tres artefactos con dueño:** `discover.md` (producto: contexto, caso de uso,
  criterios), `design.md` (arquitecto: módulos, mecanismos, canales, ADRs que
  toca) y `tasks.md` (desarrollo: tareas verificables, paralelizables).
- **La historia no se mueve:** el Discover queda fijo mientras el Design cambia;
  `change validate` avisa si una revisión de diseño reescribe el Discover.
- **Reglas por capa:** D-reglas para el Discover (sin detalles técnicos), para el
  Design (cubre cada criterio del Discover) y para las tareas (cada tarea nombra
  su requisito).
- **Rompe** el formato del change: un change de 0.27 no tiene `design.md`. Hace
  falta una migración (`specgate migrate 1.0`) que lo cree desde la proposal.

## 3. Harness por rol

**Hoy:** un prefijo de prompt, los checks de calidad y la arquitectura.

**Falta**
- **Paquetes con dueño:** `harness/security.md`, `harness/performance.md`,
  `harness/infra.md`, cada uno con su responsable, versión y a qué requisitos se
  aplica (por `kind`, capability o etiqueta).
- **Composición:** el prompt del agente suma los paquetes que tocan al requisito,
  y el informe dice cuáles se usaron.
- **Validadores por rol:** un agente revisor por paquete (hoy hay un `review`
  genérico).
- **Calidad valida el harness, no el código:** cuando un validador encuentra un
  hueco, el cambio propuesto es al paquete, no un parche.
- `harness.config.yaml` pasa a `harness_version: 2`.

## 4. El backlog sigue las fases

**Hoy:** el espejo crea y cierra issues; con el ticket como fuente, el tablero lo
mueve Jira Automation desde ramas y PRs.

**Falta**
- **Estados por fase:** propuesta → `To Do`, en el harness → `In Progress`,
  archivado → `Done`, configurable por proveedor.
- **Dos sentidos:** un comentario o un cambio de criterios en el ticket se ve en el
  change (como nota, REQ `change note`).
- **Sub-issues por repo** (con el punto 1).
- **Linear** como proveedor de serie.
- Por MCP, como pide el artículo: `specgate mcp serve` ya existe; faltan las
  herramientas de estado de la fase.

## 5. Quién aporta, quién revisa, quién aprueba

**Hoy:** un `change approve`, sin rol.

**Falta**
- **Roles en la configuración:** quién es producto, arquitectura, seguridad y
  calidad (personas o grupos del proveedor de git).
- **Aprobación por capa:** producto el Discover, arquitectura el Design, cada dueño
  su paquete de harness; quórum configurable.
- **Registro:** quién aprobó qué versión, en el change archivado (auditoría).
- **Rompe** si la aprobación pasa a ser obligatoria por defecto antes del harness.

## 6. Medir los dos huecos

**Hoy:** `harness report` mide intentos, coste y `--mark-false-failure`.

**Falta**
- **Clasificar cada fallo:** *spec → implementación* (el spec era claro, el código
  se desvió: reforzar validación y restricciones) o *intención → spec* (faltó un
  detalle del caso de uso: mejorar la elicitación). Una marca en el informe y en
  el studio, y la tasa de cada uno por módulo.
- **Retrospectiva:** el informe propone qué paquete de harness o qué regla D
  reforzar.

## 7. Steering de la organización

**Hoy:** AGENTS.md, `architecture.md` y ADRs, por repo.

**Falta**
- Un documento de principios (la "constitución") en un pack de la organización,
  heredado por cada repo, con versión; `check` dice qué versión sigue el repo y
  qué principio incumple un cambio.

## 8. Deriva por editar el código a mano

**Hoy:** "declared-value drift" como informe y `propose --from-value-drift`.

**Falta**
- Detectar un cambio de comportamiento sin cambio de spec en código que no pasó
  por el harness (un commit que toca producción sin requisito ni test que lo
  nombre), como aviso en `check` y en CI; gate opcional.

## 9. Estilos de spec

**Hoy:** SHALL + Gherkin, EARS en parte, OpenAPI dentro de packs.

**Falta**
- OpenAPI y AsyncAPI como especificación de primera clase: un requisito que
  apunta a una operación, comprobado contra el contrato.
- Generar el contrato legible por máquina desde los requisitos de API.

## 10. Brownfield grande

**Falta**
- `adopt --scope <ruta>`: specs solo para la zona que se toca.
- Aviso cuando un spec generado no cabe en una revisión (líneas, requisitos).

## Publicar la línea 1.0 sin tocar `main`

- **Rama:** `next/1.0`, cortada de develop en 0.27.9. Se trae develop cuando haya
  arreglos de 0.27.x.
- **Versiones:** `1.0.0-rc.N`.
- **Hace falta antes de la primera RC:** hoy un tag `v*` empujado publica en npm
  **siempre como `latest`** (`publish-npm.yml`, `Set publish settings`). Un tag
  `v1.0.0-rc.1` instalaría la RC a todo el mundo. La rama tiene que publicar una
  versión con `-` bajo el dist-tag `next` (y la imagen Docker sin `latest`), o
  publicarse solo por `workflow_dispatch` con `dist_tag: next`.
- **Migración:** `specgate migrate 1.0` para los puntos que rompen (1, 2, 3, 5),
  con `--dry-run`, y una guía `docs/migrating-to-1.0.md`.
- **CHANGELOG:** una sección `1.0.0` con "Breaking" por cada cambio de formato.

## Orden recomendado

1. **Publicar las RC con `next`** (requisito para todo lo demás).
2. **Discover → Design → Tasks** (2): cambia el formato, mejor primero.
3. **Workspace multi-repo** (1), con ids calificados.
4. **Backlog por fases** (4) sobre el workspace.
5. **Roles y aprobaciones** (5) y **harness por rol** (3).
6. **Medir los dos huecos** (6): barato, da las métricas.
7. Steering (7), deriva (8), estilos (9) y brownfield acotado (10).

Cada punto entra como change con sus requisitos (desde REQ-281), test primero.
