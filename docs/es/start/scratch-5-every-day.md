<!-- translation-of: 1ee271aff31d -->
# Desde cero · 5 — Cada día

> **La versión corta** de un proyecto nuevo, en seis comandos: [Empezar](../start.md). Esta página es el mismo paso en detalle, con la salida grabada.

<!-- specgate:goal -->
**Cuando termines:** el gate en cada pull request, y un bucle diario lo bastante
corto para recordarlo: cuatro verbos, `propose`, `apply`, `status` y `archive`.
<!-- specgate:endgoal -->

**Antes de empezar:** las fases [1](scratch-1-install.md) a
[4](scratch-4-prove.md) están hechas, y el proyecto está en un host de Git con CI
(GitHub, GitLab, Azure DevOps o Jenkins).

| Quién | Hace qué en esta fase |
| --- | --- |
| **Tú** | Haces commit del archivo de CI que escribió `init`; después empiezas cada día con `status` |
| **Tu agente** | Sigue el mismo bucle: `AGENTS.md` le dice cómo |
| **CI** | Ejecuta `specgate check` en cada pull request |

## 1. El gate ya está en CI

`specgate init` lo escribió: `.github/workflows/spec-gate.yml`, o el archivo
de GitLab, Azure DevOps o Jenkins cuando la carpeta muestra uno. Ejecuta
`specgate check` en Ubuntu, macOS y Windows, compara los ids de requisito con
la rama base, ejecuta los checks de calidad cuando los configuras, comprueba
los packs y mantiene el plan. Un paso cuya herramienta aún no está configurada
lo dice y pasa. Mira qué comprueba:

```bash
specgate ci status
```

<!-- specgate:out-scratch-ci:begin — generated; edit the source, not this block -->
```text
$ specgate ci status
  ◆ specgate · ci status   .github/workflows/spec-gate.yml

  ✔  the specification (validate --strict)
  ✔  the project's tests (check runs test_cmd)
  ✔  the architecture check (check runs arch_cmd)
  ✔  Ubuntu, macOS and Windows
  ✔  the requirement ids against the base branch (check --base)
  ✔  the quality checks (quality run)
  ✔  the pack drift (validate --against-lock)
  ✔  the pending-work plan (plan --format json)

  ✔  Everything specgate can check runs in CI.
```
<!-- specgate:out-scratch-ci:end -->

Comprueba de más a propósito: cada paso dice en el YAML qué comprueba y qué
borrar para quitarlo. Un único job de Ubuntu que solo ejecute
`specgate check`, sin rama base, sin deriva de packs y sin plan (solo GitHub):
`specgate ci init --provider github --minimal --force`. Otro proveedor:
`specgate ci init --provider gitlab`. Haz commit del archivo y convierte el job
en un check obligatorio en las reglas de protección de tu rama principal: a
partir de ahí, una pull request con un test en rojo no puede hacer merge.

## 2. De dónde viene el trabajo

El trabajo llega de una de tres maneras. Cada una abre un **change** —una
carpeta con los requisitos y escenarios que se añaden— y a partir de ahí el
bucle es el mismo.

| El trabajo llega como… | Abre el change con | Guía |
| --- | --- | --- |
| Un comportamiento, o una funcionalidad con pocas reglas | `specgate propose <change-id>` | Esta página, más abajo |
| Una historia de Jira con criterios de aceptación | `specgate propose --from-ticket <KEY>` | [Desde un ticket de Jira](../from-a-ticket.md) |
| Un módulo nuevo del producto, desde el brief | `specgate propose --from-brief <module>` | [Fase 2](scratch-2-specify.md) |

Un ticket de Jira se lee, nunca se escribe.
`specgate propose --from-ticket KAN-13 --check` aplica su Definition of Ready
(reglas T1–T9: criterios de aceptación presentes, medibles, lo bastante
pequeños), y el mismo comando sin `--check` abre el change y sube su rama,
`feature/KAN-13-<slug>`.

## 3. El bucle diario

1. **Propose**: abre el change y escribe su delta: los requisitos y
   escenarios que añade.
2. **Approve**: lees el delta y ejecutas `specgate change approve
   <change-id>` en tu terminal; un agente no puede, y `apply` rechaza un
   requisito de un change sin aprobar (`change_not_approved`).
3. **Build**: para cada requisito, un test que lo nombra, y después el código.
4. **Apply**: `specgate apply REQ-NNN`; haz commit.
5. **Archive**: `specgate archive <change-id>` cuando cada requisito está
   aplicado, en tu rama.
6. **Pull request**: la especificación y el código llegan juntos a revisión.
   Para el change de un ticket, el comando `alm pr` la abre; consulta
   [Desde un ticket de Jira](../from-a-ticket.md).

```
specgate propose  →  change approve  →  test and code  →  specgate apply  →  specgate archive  →  pull request
```

<!-- specgate:tip -->
**¿Perdido? Escribe `specgate` solo.** Dentro de un proyecto muestra `status`:
en qué punto está todo, y el único comando que toca ejecutar. Todos los
comandos terminan igual: un bloque **Next** con el comando solo en su línea,
para que puedas copiarlo.
<!-- specgate:endtip -->

**Un requisito nuevo** que surgió en una conversación, no en el brief:

```bash
specgate propose free-courts
```

<!-- specgate:out-scratch-propose:begin — generated; edit the source, not this block -->
```text
$ specgate propose free-courts
  ◆ specgate · propose   free-courts

  ✔  Change free-courts created · lite · REQ ids REQ-012…REQ-014 reserved

    + docs/specs/changes/free-courts/change.yaml
    + docs/specs/changes/free-courts/discover.md
    + docs/specs/changes/free-courts/design.md
    + docs/specs/changes/free-courts/tasks.md
    + docs/specs/changes/free-courts/specs/free-courts/spec.md

  Next ───────────────────────────────────────────────────
  ➜  specgate apply
     after you write the delta, a test that names each requirement, and the code
```
<!-- specgate:out-scratch-propose:end -->

Sustituye la plantilla del delta del change,
`docs/specs/changes/free-courts/specs/free-courts/spec.md`, por el requisito
y su escenario, bajo el encabezado `## ADDED Requirements` que trae la
plantilla:

```markdown
# Delta — free-courts

## ADDED Requirements

### Requirement: REQ-012 — A member sees which courts are free on a day

<!-- specgate:trace actor=Member kind=functional -->

The system SHALL list, for a day, the courts that are free at each hour.

#### Scenario: SCN-006 — The centre court is taken on Monday evening

- GIVEN the centre court is booked on Monday evening
- WHEN a member sends GET /api/courts/free?day=monday
- THEN Monday evening lists every court except the centre court
```

Lee el delta y apruébalo tú, en tu terminal; `apply` lo espera:

```bash
specgate change approve free-courts
```

**Empieza el día con `status`**: lista el requisito nuevo con el resto, y
nombra el único comando que toca ejecutar:

```bash
specgate status
```

<!-- specgate:out-scratch-status-daily:begin — generated; edit the source, not this block -->
```text
$ specgate status
  ◆ specgate · status   court-bookings

  Requirements  █████░░░░░░░░░░░░░░░  1 of 4 done

  To do ──────────────────────────────────────────────────
    ○ REQ-003  A court is never booked twice for the same …  a test and code
    ○ REQ-012  A member sees which courts are free on a day  a test and code

  ·  REQ-001 Preserve existing behaviour: your test suite holds it on every check.
     To close it, name REQ-001 in a test that starts the product.

  Waiting for an answer ──────────────────────────────────
    ○ REQ-004  A member cancels a booking  an answer to Q1
    Questions: Q1 (docs/specs/changes/draft-bookings/questions.md)

  Brief         ████████████████████  1 of 1 module(s) drafted   docs/brief.md

  Next ───────────────────────────────────────────────────
  ➜  specgate apply REQ-003
     free-courts waits for a person to approve it, at their terminal — apply delivers nothing before
```
<!-- specgate:out-scratch-status-daily:end -->

Esta grabación ejecutó `status` antes de la aprobación, así que su última línea
aún dice que free-courts espera a una persona. Una vez aprobado, REQ-012 se
entrega como los demás: su test, su código, `specgate apply REQ-012`.

**Un requisito que cambia** también pasa por un change, bajo
`## MODIFIED Requirements` en su delta, para que la revisión vea el antes y el
después.

## 4. Cuando el cliente responde

El requisito que bloqueaba vuelve a la cola en cinco pasos:

1. En el `questions.md` del change, escribe la respuesta en la celda `Answer`
   de la pregunta y pon su `Status` en `answered`. `status` lista ahora el
   requisito bajo "Answered — update the spec".
2. Escribe el valor en el texto del requisito y en su escenario.
3. Quita `status="Needs Clarification"` de su `specgate:trace`.
4. Aprueba el change de nuevo, tú, en tu terminal:
   `specgate change approve <change>`. El texto ya no es el que se aprobó, así
   que `apply` lo rechaza (`approved_requirement_changed`) hasta entonces;
   la respuesta del cliente en `questions.md` es la fuente del valor nuevo.
5. Escribe su test, y después `specgate apply REQ-…`. Hasta el paso 3 el harness
   lo omite y `apply` lo rechaza (`done_needs_clarification`).

## Gato, el gato que guarda el gate

Al pie de `status`, en tu terminal, está Gato. No lo alimentas a mano:
su estado es el del proyecto.

| Gato | Viene de | Lo cuidas con |
| --- | --- | --- |
| Crece: huevo, gatito, gato, leyenda coronada | la proporción de requisitos cerrados | `specgate apply` |
| Sano, o enfermo | cómo terminó el último `specgate check` | un gate en verde |
| Preocupado | requisitos que esperan una respuesta | responder `questions.md` |
| Dormido | ningún `check` en una semana | ejecutar `check` |
| Racha 🔥 | días seguidos en que el gate terminó en verde | mantenerlo en verde |

Diga lo que diga, termina con el mismo comando que te da `status`. `specgate pet`
muestra el gato entero y sus cuatro necesidades. Nunca aparece en una tubería,
un log o en CI, y `specgate config set pet off` lo guarda. La racha vive en
`.specgate/pet.json`, que git ignora: el gato es tuyo, no del equipo.

## Has terminado cuando…

- `.github/workflows/spec-gate.yml` (o el archivo de tu proveedor) está en un
  commit, y el job es un check obligatorio.
- Tu equipo empieza con `specgate status` y termina cada change con
  `specgate archive` y una pull request.

## Si algo sale mal

| Ves | Significa | Haz |
| --- | --- | --- |
| `.github/workflows/spec-gate.yml already exists — refusing to overwrite.` | Ya tienes ese archivo | `--stdout` para imprimir el job y pegarlo, o `--force` para sustituirlo |
| `Unknown provider: circleci` | No está soportado | `github`, `gitlab`, `azure` o `jenkins`; o ejecuta `specgate check` a mano desde cualquier CI |
| `status` dice `Next  specgate plan` | Un requisito no tiene archivo feature | `specgate plan` lo nombra |

## Siguiente

- [Desde un ticket de Jira](../from-a-ticket.md)
- [Escribe buenos requisitos y escenarios](../writing-specs.md)
- [La primera pull request de tu equipo: autor y revisor](../first-pr.md)
- [Entrega el bucle a un agente: el harness](../harness.md)
- [Todos los comandos](../commands.md)

[← Volver al principio](../getting-started.md)
