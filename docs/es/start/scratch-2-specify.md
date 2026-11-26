<!-- translation-of: c918be1b9244 -->
# Desde cero · 2 — Del brief a una especificación comprobada

> **La versión corta** de un proyecto nuevo, en seis comandos: [Empezar](../start.md). Esta página es el mismo paso en detalle, con la salida grabada.

<!-- specgate:goal -->
**Cuando termines:** un módulo del brief del cliente redactado como requisitos
y escenarios Gherkin, comprobado para que nada en ellos sea inventado, y
revisado por una persona. El borrador sigue abierto como change: sus requisitos
se construyen y se aplican en las fases 3 y 4, y solo entonces se archiva en la
especificación.
<!-- specgate:endgoal -->

**Antes de empezar:** la [fase 1](scratch-1-install.md) está hecha, y el brief
está escrito: [Escribe el brief](write-the-brief.md) enseña cómo.

Unas pocas palabras que se usan en esta página:

- **Change**: una carpeta bajo `docs/specs/changes/` que guarda un trabajo
  hasta que se construye: `discover.md` (por qué), `design.md` (cómo), `tasks.md`, y un
  **delta**, los requisitos y escenarios que añade o modifica.
- **Borrador**: un change abierto a partir de un módulo del brief.
- **La checklist**: las reglas de redacción D1–D16 que `propose --from-brief`
  aplica a un borrador, cada hallazgo con su corrección.

| Quién | Hace qué en esta fase |
| --- | --- |
| **Tú** | Pones el brief en el repositorio, revisas el borrador, decides qué es una suposición y qué es una pregunta para el cliente |
| **Tu agente** | Escribe el primer borrador de un módulo |
| **La checklist** | Encuentra lo que el brief no dice: escenarios que faltan, valores inventados, requisitos sin medida |

## 1. Guarda el brief en el repositorio

Guárdalo como `docs/brief.md`, tal como lo escribió el cliente; un plan que
escribiste tú sirve igual. Un front matter breve al principio nombra los
módulos que se redactan de uno en uno, y quién usa el producto por qué
superficies; a partir de él, la checklist pide un escenario por actor y superficie.

```markdown
---
product: Court bookings for a tennis club
surfaces: [api]
actors:
  - { name: Member, surfaces: [api] }
modules: [bookings]
---

# Brief

Members book a court for one hour. A court cannot be booked twice for
the same hour. Members can cancel a booking. Late cancellations may be charged.
```

## 2. Mira los módulos

```bash
specgate propose --from-brief
```

<!-- specgate:out-scratch-draft-list:begin — generated; edit the source, not this block -->
```text
$ specgate propose --from-brief
  ◆ specgate · propose --from-brief   docs/brief.md

  Product   Court bookings for a tennis club
  Progress  ░░░░░░░░░░░░░░░░░░░░  0 of 1 archived

  Modules ────────────────────────────────────────────────
    ○ bookings  not started

  Next ───────────────────────────────────────────────────
  ➜  specgate propose --from-brief bookings
```
<!-- specgate:out-scratch-draft-list:end -->

`specgate propose --from-brief` lee el brief y dice en qué punto está cada
módulo y cuál es el siguiente. Ejecútalo de nuevo siempre que no sepas qué
viene después.

## 3. Abre el módulo y pásaselo a tu agente

```bash
specgate propose --from-brief bookings
```

<!-- specgate:out-scratch-draft-open:begin — generated; edit the source, not this block -->
```text
$ specgate propose --from-brief bookings
  ◆ specgate · propose --from-brief bookings   docs/brief.md

  ✔  Draft draft-bookings opened · REQ ids REQ-002…REQ-011 reserved

    + docs/specs/changes/draft-bookings/DRAFTING.md                                     how to write it
    + docs/specs/changes/draft-bookings/specs/bookings/spec.md                          the requirements go here
    + docs/specs/changes/draft-bookings/change.yaml, discover.md, design.md, tasks.md   the layers

  Have your agent write it ───────────────────────────────
  Paste this into Claude Code, Cursor, Codex…

    Draft the bookings module: follow docs/specs/changes/draft-bookings/DRAFTING.md

  Next ───────────────────────────────────────────────────
  ➜  specgate propose --from-brief bookings --agent "claude -p"
     or let Specgate call it — then run specgate propose --from-brief bookings until it says Ready to review
```
<!-- specgate:out-scratch-draft-open:end -->

El borrador es un change llamado `draft-bookings`, enlazado al brief y
separado de la especificación hasta que una persona lo haya revisado. Reserva
los ids de requisito REQ-002 a REQ-011. El `DRAFTING.md` que contiene es el
prompt para tu agente: el alcance del módulo, los ids reservados, cada actor y
superficie del front matter, y los formatos que lee la checklist. Pega la línea
que imprime el comando en Claude Code, Cursor, Codex o cualquier otro agente, o
deja que Specgate llame al agente por ti:

```bash
specgate propose --from-brief bookings --agent "claude -p"
```

El prompt le llega al agente por la entrada estándar (un comando que contiene
`{prompt_file}` lo recibe en un archivo). Lo que el agente escriba fuera de la
carpeta del borrador se deshace después —un archivo que habías cambiado vuelve
a tu versión, no al último commit— y el borrador se comprueba en cuanto el
agente termina. Ejecuta `--agent` de nuevo sobre un borrador con hallazgos y
el agente recibe esos hallazgos, con sus correcciones, en su prompt.

El borrador de esta página es el que muestra la página de inicio: tres
requisitos, cuatro escenarios, y una tarifa de 5 euros por cancelar tarde que
el cliente nunca mencionó:

| Requisito | Sus escenarios |
| --- | --- |
| REQ-002 — Un socio reserva una pista para una hora | SCN-002 reservar una pista libre · SCN-003 un socio ve sus reservas |
| REQ-003 — Una pista nunca se reserva dos veces para la misma hora | SCN-004 la segunda reserva se rechaza |
| REQ-004 — Un socio cancela una reserva | SCN-005 cancelar tarde se cobra |

Tu agente escribe su propio borrador: los ids, los escenarios y los hallazgos
de abajo serán otros. El borrador también tiene `use-cases.md`: cada requisito
nombra su caso de uso (`uc=UC-002` en su trace, D14), y cada caso de uso
recibe su especificación, `use-cases/UC-002.md`, cuyos flujos nombran los
escenarios; sin ella, la comprobación dice `D15_no_spec`.

## 4. Compruébalo: el mismo comando, otra vez

Una vez que el borrador existe, el mismo comando lo comprueba:

```bash
specgate propose --from-brief bookings
```

<!-- specgate:out-scratch-draft-check:begin — generated; edit the source, not this block -->
```text
$ specgate propose --from-brief bookings
  ◆ specgate · propose --from-brief bookings   docs/brief.md

  3 requirement(s) · 4 scenario(s)

  ✖  D6_unlisted_value  SCN-002 states "201", which is not in the brief and not listed as an assumption for SCN-002 or REQ-002.
     fix: List it in assumptions.md with SCN-002 (or REQ-002) in its row, or use the value the brief gives.
  ✖  D6_unlisted_value  SCN-004 states "court already booked", which is not in the brief and not listed as an assumption for SCN-004 or REQ-003.
     fix: List it in assumptions.md with SCN-004 (or REQ-003) in its row, or use the value the brief gives.
  ✖  D6_unlisted_value  SCN-004 states "409", which is not in the brief and not listed as an assumption for SCN-004 or REQ-003.
     fix: List it in assumptions.md with SCN-004 (or REQ-003) in its row, or use the value the brief gives.
  ✖  D6_unlisted_value  SCN-005 states "204", which is not in the brief and not listed as an assumption for SCN-005 or REQ-004.
     fix: List it in assumptions.md with SCN-005 (or REQ-004) in its row, or use the value the brief gives.
  ✖  D6_unlisted_value  SCN-005 states "5", which is not in the brief and not listed as an assumption for SCN-005 or REQ-004.
     fix: List it in assumptions.md with SCN-005 (or REQ-004) in its row, or use the value the brief gives.

  ✖  5 finding(s) to fix — each says how; DRAFTING.md has the formats

  What now ───────────────────────────────────────────────
   1  ➜ specgate propose --from-brief bookings --agent "claude -p"   your agent fixes them — or fix them yourself
   2  ➜ specgate propose --from-brief bookings   again, until it says Ready to review
```
<!-- specgate:out-scratch-draft-check:end -->

Cada valor que afirma un escenario debe estar en el brief o anotado como
suposición: D6 marca cada valor concreto —un código, un importe, un nombre
entre comillas— que el brief no da. Cuántos hallazgos tengas depende del
borrador; este tiene cinco. Aquí los códigos HTTP son una convención
razonable —una **suposición**—, pero la tarifa es una decisión de negocio que
solo puede tomar el cliente: una **pregunta**. Así que:

1. Listas los códigos HTTP en `assumptions.md`, con los requisitos a los que se aplican.
2. Preguntas por la tarifa en `questions.md`, diciendo qué requisito bloquea
   (`Q1 · REQ-004`).
3. Marcas REQ-004 con `status="Needs Clarification"` y escribes su escenario
   sin el número.

Después compruebas de nuevo:

```bash
specgate propose --from-brief bookings
```

<!-- specgate:out-scratch-draft-check-again:begin — generated; edit the source, not this block -->
```text
$ specgate propose --from-brief bookings
  ◆ specgate · propose --from-brief bookings   docs/brief.md

  3 requirement(s) · 4 scenario(s)

  ✔  Ready to review

  What now ───────────────────────────────────────────────
   1  Read docs/specs/changes/draft-bookings/specs/ with whoever knows the business
   2  Answer what you can in docs/specs/changes/draft-bookings/questions.md
   3  ➜ specgate change approve draft-bookings   you, at your terminal, once it reads right — apply waits for it
   4  ➜ specgate apply   its requirements, one at a time; then specgate archive draft-bookings
   5  ➜ specgate status   every module drafted: what to build first
```
<!-- specgate:out-scratch-draft-check-again:end -->

## 5. Revísalo, y déjalo abierto

Lee el borrador con quien conozca el negocio y responde lo que puedas en
`questions.md`. La revisión se hace en la pull request del borrador; todavía
no se archiva nada. Cuando se lea bien, una persona lo aprueba en su terminal
—`specgate change approve draft-bookings`, el primer paso de la
[fase 3](scratch-3-build.md) y el siguiente paso que nombra `status` abajo.

Los requisitos de un change abierto están **en curso**: `status`, `check` y
`apply` los leen del change, y el gate los juzga tal como serán una vez
archivados. Archivas el change después de construir y aplicar sus requisitos,
para que la especificación y su código lleguen juntos a revisión
([fase 4](scratch-4-prove.md)).

## 6. Mira qué sigue

```bash
specgate status
```

<!-- specgate:out-scratch-status:begin — generated; edit the source, not this block -->
```text
$ specgate status
  ◆ specgate · status   court-bookings

  Requirements  ░░░░░░░░░░░░░░░░░░░░  0 of 3 done

  To do ──────────────────────────────────────────────────
    ○ REQ-002  A member books a court for one hour           a test and code
    ○ REQ-003  A court is never booked twice for the same …  a test and code

  ·  REQ-001 Preserve existing behaviour: your test suite holds it on every check.
     To close it, name REQ-001 in a test that starts the product.

  Waiting for an answer ──────────────────────────────────
    ○ REQ-004  A member cancels a booking  an answer to Q1
    Questions: Q1 (docs/specs/changes/draft-bookings/questions.md)

  Brief         ████████████████████  1 of 1 module(s) drafted   docs/brief.md

  Next ───────────────────────────────────────────────────
  ➜  specgate change approve draft-bookings
     draft-bookings waits for a person to approve it, at their terminal — apply delivers nothing before
```
<!-- specgate:out-scratch-status:end -->

REQ-004 está **esperando una respuesta**: el harness no lo construirá y
`apply` no lo entregará hasta que el cliente responda Q1. La respuesta cambia
REQ-004, así que una persona vuelve a aprobar el borrador antes de que se
construya. Nadie tiene que acordarse de ello.

## Has terminado cuando…

- `specgate propose --from-brief bookings` dice `✔  Ready to review` y una persona ha leído el borrador.
- `specgate status` lista sus requisitos, y el borrador sigue abierto.
- Cada pregunta abierta está en `questions.md`, y el requisito que bloquea lo dice.

Para el siguiente módulo, `specgate propose --from-brief` lo nombra; repite los
pasos 3–5. [Desde un brief](../from-a-brief.md) tiene la checklist completa
(D1–D16) y lo que significa cada hallazgo.

## Si algo sale mal

| Ves | Significa | Haz |
| --- | --- | --- |
| `D6_unlisted_value … states "5", which is not in the brief` | Un valor que nadie pidió | Usa el valor del brief, lístalo como suposición o conviértelo en una pregunta |
| `No plan or brief at docs/brief.md. [draft_no_brief]` | El brief está en otro sitio, o aún no se ha guardado | Guárdalo como `docs/brief.md`, o pasa `--brief <file>` |
| `Your brief does not list its modules yet.` | No hay `modules:` en el front matter | Pega el front matter que imprime, o nombra el módulo: `specgate propose --from-brief bookings` |
| `The draft is still the placeholder.` | Nadie ha escrito todavía el borrador | Pega la línea impresa en tu agente, o usa `--agent` |
| `--agent needs a git repository. [draft_agent_needs_git]` | Git es cómo se confinan las escrituras del agente | `git init`, o pega tú la línea en tu agente |
| `Scenario "<scenario name>" has placeholder steps, so it asserts nothing.` | Un escenario se quedó como la plantilla | Escribe lo que debe cumplirse, o borra el escenario |

## Siguiente

**[Fase 3: construye el primer requisito →](scratch-3-build.md)**
