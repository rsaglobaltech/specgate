<!-- translation-of: cb0d202103c0 -->
# Escribe el brief

> **La versión corta** de ambos caminos, en seis comandos: [Empezar](../start.md). Esta página es el mismo paso en detalle, con la salida grabada.

**Antes de redactar nada.** Un brief dice lo que el producto debe hacer, con
las palabras de quienes lo necesitan. Specgate redacta la especificación a
partir de él, un módulo cada vez, y comprueba cada borrador contra él. Esta
página enseña el brief en nueve pasos, unos 28 minutos, con un único ejemplo
de principio a fin: **Lingo**, una escuela de idiomas en línea inventada.

**Cuando termines:** un `docs/brief.md` que `specgate propose --from-brief --check`
da por listo, con sus módulos listados y el primero nombrado.

**Antes de empezar:** un proyecto con Specgate configurado:
la [fase 1](scratch-1-install.md) del recorrido desde cero.

| Quién | Hace qué |
| --- | --- |
| **Tú** | Escribes el brief, o revisas lo que tu agente propone a partir de tus notas |
| **Tu agente** | Puede proponer los campos y las secciones de los módulos; nada más |
| **Specgate** | Comprueba el brief antes de redactar nada, cada hallazgo con su corrección |

## ¿Necesitas un brief?

A menudo no. Un brief es para un producto, o para una parte grande de uno.

| Tienes… | Haz esto |
| --- | --- |
| Un comportamiento que corregir o cambiar | Sin brief. `specgate propose <change-id>`, y escribe el requisito en el delta. |
| Una funcionalidad con pocas reglas (2–6) | Sin brief. `specgate propose <change-id>`, con las reglas y los ejemplos en el delta. |
| Un producto, o un área grande de uno | Un brief, y luego `specgate propose --from-brief`, un módulo cada vez. |
| Una historia que tu analista escribió en Jira | Sin brief. `specgate propose --from-ticket <KEY>`: el ticket es la fuente. Consulta [Desde un ticket de Jira](../from-a-ticket.md). |

## Palabras que se usan aquí

- **Brief**: `docs/brief.md`: lo que el producto debe hacer, antes de especificar nada.
- **Front matter**: los campos entre las dos líneas `---` al principio del brief.
- **Módulo**: una pieza del producto, que se redacta y se revisa por separado.
- **Actor**: una persona o un sistema que usa el producto.
- **Superficie**: por dónde llega un actor al producto: `api`, `web`, `mobile` o `desktop`.
- **Regla**, **ejemplo**, **pregunta**: los tres tipos de tarjeta de un módulo.
- **Requisito**, **escenario**: en lo que se convierten una regla y un ejemplo en el borrador.
- **Change**: una carpeta bajo `docs/specs/changes/` que guarda los requisitos
  y escenarios que añade un trabajo, hasta que se construye.
- **Borrador**: el change que abre `specgate propose --from-brief <module>`.

## Crea el archivo

¿Tienes notas, un correo, un plan? Guárdalos tal cual como `docs/brief.md` y
salta a [¿Ya tienes notas?](#ya-tienes-notas). Si partes de cero:

```bash
specgate propose --from-brief --new-brief
```

<!-- specgate:out-brief-new:begin — generated; edit the source, not this block -->
```text
$ specgate propose --from-brief --new-brief
  ◆ specgate · propose --from-brief --new-brief

  ✔  Wrote docs/brief.md — a brief to fill in.

  Fill it in, in your own words:
    1. The four fields at the top — product, surfaces, actors, modules.
       Each has an example in the comment above it.
    2. Why — the problem, and a success you can measure.
    3. Per module, a section: its Rules, an Example per rule, and the
       Questions you cannot answer yet.

  Have a plan or an email already? Paste it under Notes — your agent can
  turn it into the module sections: specgate propose --from-brief --agent "claude -p"

  Next ───────────────────────────────────────────────────
  ➜  specgate propose --from-brief --check
     it checks the brief and says what is missing
```
<!-- specgate:out-brief-new:end -->

## Paso 1 — Por qué (3 minutos)

Bajo `## Why`, el problema en dos frases, los objetivos y cómo sabrás que se
cumplen, cada uno con un valor y su unidad. Un Why sin número recibe la
advertencia `B15_why_unmeasured`.

- Bien: "A student finds today's lesson in under 10 seconds."
- Mal: "Fast and easy to use." Ningún test puede comprobarlo.

El de Lingo, que va bajo el título del ejemplo completo del final de esta
página, antes de su primer `## Module:`:

```markdown
## Why

Students lose track of their lessons between classes, and the teacher cannot
see who is falling behind.

- A student finds today's lesson in under 10 seconds.
- The teacher sees each student's progress in under 2 seconds.
```

## Paso 2 — Quién y dónde (3 minutos)

El principio del brief nombra el producto, por dónde llega la gente a él y
quién lo usa en cada sitio. Cada actor recibe un escenario en cada una de sus
superficies, para que no se olvide ninguna pantalla.

```yaml
product: Lingo — online lessons for a language school
surfaces: [web, mobile]
actors:
  - { name: Teacher, surfaces: [web] }
  - { name: Student, surfaces: [web, mobile] }
```

`api` significa que otro programa llama al producto; `web`, `mobile` y
`desktop` son pantallas. Una tablet es `web` o `mobile`.

## Paso 3 — Lo que no hará (2 minutos)

`non_goals: [video calls]`. La protección más barata contra un borrador que
crece: una regla o un ejemplo que nombra un non-goal recibe una advertencia.

## Paso 4 — Módulos (3 minutos)

`modules: [courses, lessons, exercises, progress]`: de tres a ocho piezas, en
el orden en que las construirás, primero aquello de lo que dependen otras.
Palabras en minúscula con guiones. Cada una lo bastante pequeña para revisarla
de una sentada: 25 requisitos como mucho, y como mucho siete reglas en su
sección.

## Paso 5 — Reglas, por módulo (8 minutos)

Una sección por módulo, `## Module: courses`, y bajo `Rules` una frase por
cada cosa que debe cumplirse. Cada regla se convierte en un requisito.

- Números con su unidad; etiquetas y mensajes entre comillas dobles,
  exactamente como los dirá la pantalla. Un borrador que usa los valores del
  brief pasa por construcción la comprobación que los compara (D6).
- Cuando una regla tiene una condición, empieza por ella: los patrones EARS:

| Patrón | Ejemplo |
| --- | --- |
| Siempre | A course has one level, from "A1" to "C2". |
| Cuando (un evento) | When a lesson is published, the students of its course see it. |
| Mientras (un estado) | While a course is full, joining it is refused. |
| Donde (una opción) | Where the school sells by course, a student pays per course. |
| Si (no deseado) … entonces | If a student misses 3 lessons, then the teacher is told. |

- Una ley o norma que aplica: nómbrala, con su fuente.
- Capturas de pantalla: di con palabras lo que muestran. Un valor que solo
  está en una imagen es invisible para la comprobación.

## Paso 6 — Ejemplos, por regla (4 minutos)

Bajo `Examples`, al menos uno por regla: "The one where…", con los propios
valores de la regla. Cada uno se convierte en un escenario. Incluye cómo
encuentra cada actor aquello sobre lo que actúa —una lista, una búsqueda— o el
borrador no podrá decir de dónde viene un id.

## Paso 7 — Preguntas (2 minutos)

Bajo `Questions`, lo que todavía no sabes de este módulo: como mucho tres. Se
convierten en filas de `questions.md`, para que las responda el cliente: nunca
en suposiciones.

## Paso 8 — Calidad (3 minutos)

Bajo `## Quality`, lo bien que debe funcionar el producto: una línea por
necesidad, que empieza con su característica de
[ISO/IEC 25010](https://www.iso.org/standard/78176.html), cada una con un
número que un test pueda comprobar. Nombra los módulos entre paréntesis cuando
la necesidad no es de todo el producto.

```markdown
## Quality

- performance efficiency (lessons): A lesson opens in under 3 seconds for 500 students at once.
- reliability: Available 99.5% of each month.
- interaction capability: Every screen meets WCAG 2.2 AA.
```

Las nueve características: functional suitability, performance efficiency,
compatibility, interaction capability, reliability, security,
maintainability, flexibility, safety. Sus nombres antiguos y comunes
—usability, portability, availability, privacy, y los nombres en español— se
leen como la característica a la que pertenecen.

Cada línea se convierte en un requisito no funcional: en el borrador del
módulo que nombra o, cuando no nombra ninguno, en el borrador del primer
módulo. Una línea que ningún test puede comprobar —"loads fast"— es el error
`B14_quality_unmeasured` y detiene el borrador. Omite la sección si el brief
no dice nada al respecto.

## Paso 9 — Compruébalo

```bash
specgate propose --from-brief --check
```

Los errores impiden que se abra un borrador: un campo con la forma
equivocada, un módulo vacío, un módulo sin su sección, reglas sin ejemplos.
Las advertencias son para que las juzgues tú: una palabra vaga, una promesa
sin número, un framework nombrado en una regla, un módulo demasiado grande,
una condición puesta al final, más de ocho módulos, un actor en una superficie
que el proyecto no tiene (`mobile` sin app móvil). Sobre el brief de Lingo que
propuso el agente, más abajo:

<!-- specgate:out-brief-check:begin — generated; edit the source, not this block -->
```text
$ specgate propose --from-brief --check
  ◆ specgate · propose --from-brief --check   docs/brief.md

  ▲  B5_vague  progress  "A student sees their progress quickly." says "quickly", which no test can check.
     fix: Say what it means in values: "in under 2 seconds", "with one tap", or move it to Questions.
  ▲  B6_unmeasured  progress  "A student sees their progress quickly." promises a quantity and states no number.
     fix: Give the number and its unit: "within 2 seconds", "for 500 students at once".

  ✔  Ready to draft — 2 warning(s) for you to judge

  Next ───────────────────────────────────────────────────
  ➜  specgate propose --from-brief courses
     the first module
```
<!-- specgate:out-brief-check:end -->

"Quickly" se convirtió en "in under 2 seconds": el éxito del Paso 1.

## ¿Ya tienes notas?

Pégalas tal cual en `docs/brief.md`. Tu agente propone primero los campos y
después las secciones de los módulos; tú revisas cada cosa antes de redactar
nada.

```bash
specgate propose --from-brief --agent "claude -p"
```

<!-- specgate:out-brief-agent:begin — generated; edit the source, not this block -->
```text
$ specgate propose --from-brief --agent "claude -p"
  ◆ specgate · propose --from-brief --agent   docs/brief.md

  ➜  claude --strict-mcp-config --permission-mode acceptEdits -p  is proposing the front matter of docs/brief.md…
     edit permission added: claude -p cannot write files otherwise

Added a front matter to docs/brief.md: 2 actors, 4 modules; one line marked to check.

  ────────────────────────────────────────────────────────────────────────────

  ✔  The agent proposed this, at the top of docs/brief.md:

    │ ---
    │ product: Lingo — online lessons for a language school
    │ surfaces: [web, mobile]
    │ actors:
    │   - { name: Teacher, surfaces: [web] }
    │   # check: the brief says students use "the web or their phone"
    │   - { name: Student, surfaces: [web, mobile] }
    │ modules: [courses, lessons, exercises, progress]
    │ ---

  ℹ  Your brief below it is unchanged.

  Next ───────────────────────────────────────────────────
  ➜  specgate propose --from-brief
     review it — change anything — then run it
```
<!-- specgate:out-brief-agent:end -->

Revisa los campos —aquí, resuelve la línea `# check:` y añade `non_goals`— y
ejecuta de nuevo el mismo comando. Con los campos completos, el agente propone
una sección por módulo, solo a partir de tus notas:

<!-- specgate:out-brief-cards-agent:begin — generated; edit the source, not this block -->
```text
$ specgate propose --from-brief --agent "claude -p"
  ◆ specgate · propose --from-brief --agent   docs/brief.md

  ➜  claude --strict-mcp-config --permission-mode acceptEdits -p  is proposing the module sections of docs/brief.md…
     edit permission added: claude -p cannot write files otherwise

Added 4 module sections from your notes; 3 questions the notes leave open.

  ────────────────────────────────────────────────────────────────────────────

  ✔  The agent proposed 4 module section(s) in docs/brief.md: courses, lessons, exercises, progress

  ℹ  Every line you wrote is still there.

  Next ───────────────────────────────────────────────────
  ➜  specgate propose --from-brief --check
     review the sections — change anything — then check them
```
<!-- specgate:out-brief-cards-agent:end -->

El agente solo puede escribir `docs/brief.md`, y solo añadirle cosas: si
cambia una sola línea de tus notas, el brief vuelve a quedar como estaba. (La
grabación usa un sustituto de Claude que escribe el texto que se muestra
abajo.)

## El ejemplo completo

El brief de Lingo, revisado. Su `## Why` es el del paso 1, bajo el título
`# Lingo`; el bloque de abajo lo omite:

<!-- specgate:example-brief -->
```markdown
---
product: Lingo — online lessons for a language school
surfaces: [web, mobile]
actors:
  - { name: Teacher, surfaces: [web] }
  - { name: Student, surfaces: [web, mobile] }
modules: [courses, lessons, exercises, progress]
non_goals: [video calls]
---

# Lingo

Lingo is an online language school. A teacher runs small groups of adult
students.

The teacher creates courses by level and publishes lessons with their
material. Students follow their course on the web or on their phone, do the
exercises of each lesson and see their progress quickly. The teacher sees
each student's progress and corrects written exercises.

We don't know yet whether students pay per course or per month.

## Module: courses

Rules
- A teacher creates a course with one level, from "A1" to "C2".
- A student follows one course.

Examples
- The one where the teacher creates "Spanish A2".
- The one where Ana follows "Spanish A2".

Questions
- Can a student follow two courses at once?
- Do students pay per course or per month?

## Module: lessons

Rules
- A teacher publishes a lesson in a course, with its material.
- When a lesson is published, the students of its course see it.

Examples
- The one where the teacher publishes "Greetings" in "Spanish A2" with a PDF.
- The one where Ana opens "Spanish A2" on her phone and sees "Greetings".

## Module: exercises

Rules
- A lesson has exercises, done on the web or on the phone.
- The teacher corrects written exercises.

Examples
- The one where Ana answers the 3 exercises of "Greetings".
- The one where the teacher corrects Ana's written answer.

Questions
- Are the other exercises corrected automatically?

## Module: progress

Rules
- A student's progress opens in under 2 seconds.
- The teacher sees each student's progress.

Examples
- The one where Ana has done 2 of the 3 exercises of "Greetings" and sees 2 of 3.
- The one where the teacher sees Ana at 2 of 3.

## Quality

- reliability: Lingo is available 99.5% of each month.
- interaction capability: Every screen meets WCAG 2.2 AA.
```

Listo, lista los módulos y nombra el primero:

<!-- specgate:out-brief-ready:begin — generated; edit the source, not this block -->
```text
$ specgate propose --from-brief
  ◆ specgate · propose --from-brief   docs/brief.md

  Product   Lingo — online lessons for a language school
  Progress  ░░░░░░░░░░░░░░░░░░░░  0 of 4 archived

  Modules ────────────────────────────────────────────────
    ○ courses    not started
    ○ lessons    not started
    ○ exercises  not started
    ○ progress   not started

  Next ───────────────────────────────────────────────────
  ➜  specgate propose --from-brief courses
```
<!-- specgate:out-brief-ready:end -->

Abrir el borrador del primer módulo le entrega a quien lo escriba —tú o tu
agente— las tarjetas de ese módulo, sus valores y sus preguntas, en
`DRAFTING.md`:

<!-- specgate:out-brief-draft:begin — generated; edit the source, not this block -->
```text
$ specgate propose --from-brief courses
  ◆ specgate · propose --from-brief courses   docs/brief.md

  ✔  Draft draft-courses opened · REQ ids REQ-002…REQ-011 reserved

    + docs/specs/changes/draft-courses/DRAFTING.md                                     how to write it
    + docs/specs/changes/draft-courses/specs/courses/spec.md                           the requirements go here
    + docs/specs/changes/draft-courses/change.yaml, discover.md, design.md, tasks.md   the layers

  Have your agent write it ───────────────────────────────
  Paste this into Claude Code, Cursor, Codex…

    Draft the courses module: follow docs/specs/changes/draft-courses/DRAFTING.md
… 4 more lines
```
<!-- specgate:out-brief-draft:end -->

<!-- specgate:out-brief-scope:begin — generated; edit the source, not this block -->
```text
$ sed -n '/^## 0/,/^## 1/p' docs/specs/changes/draft-courses/DRAFTING.md | sed '$d'
## 0. Your scope — the courses section of the brief

This is the only text you draft from. Each **rule** becomes a requirement
(quote it under `> Brief:`), each **example** a scenario of that
requirement, each **question** a row of `questions.md`.

````markdown
## Module: courses

Rules
- A teacher creates a course with one level, from "A1" to "C2".
- A student follows one course.

Examples
- The one where the teacher creates "Spanish A2".
- The one where Ana follows "Spanish A2".

Questions
- Can a student follow two courses at once?
- Do students pay per course or per month?
````

**The values you may use** — write them exactly so; any other value goes
in `assumptions.md` or becomes a question:

`"A1"` · `"C2"` · `"Spanish A2"`

**Questions to copy into `questions.md`**, each with the requirements it
blocks:

- Can a student follow two courses at once?
- Do students pay per course or per month?

**Quality requirements to write** — from the brief's `## Quality` section
(ISO/IEC 25010). Each becomes one requirement of kind `non-functional`,
its entry quoted under `> Brief:`, with a scenario that measures its
number:

- reliability: Lingo is available 99.5% of each month.
- interaction capability: Every screen meets WCAG 2.2 AA.
```
<!-- specgate:out-brief-scope:end -->

Una regla de lessons, tal como la escribiría su borrador: la regla citada, el
ejemplo como un escenario con los propios valores del brief:

```markdown
### Requirement: REQ-004 — Students see a published lesson

<!-- specgate:trace actor=Student kind=functional surfaces=mobile -->

The system SHALL show a lesson to the students of its course once it is published.

> Brief: "When a lesson is published, the students of its course see it."

#### Scenario: SCN-006 — Ana sees "Greetings" on her phone

- GIVEN the teacher published "Greetings" in "Spanish A2", which Ana follows
- WHEN Ana opens "Spanish A2" on her phone
- THEN she sees "Greetings" among its lessons
```

## Has terminado cuando…

- `specgate propose --from-brief --check` dice **Ready to draft**.
- `specgate propose --from-brief` lista tus módulos y nombra el primero.

## Si algo sale mal

| Ves | Significa | Haz |
| --- | --- | --- |
| `brief_wrong_shape` | Un campo está escrito como palabras, no como lista | Usa la forma que muestra su corrección: `surfaces: [web]` |
| `B2_empty_module` | La sección de un módulo sigue vacía o es un comentario | Escribe sus reglas y ejemplos |
| `B3_no_section` | Un módulo no tiene sección `## Module:` | Añade una, o quítalo de `modules:` |
| `B14_quality_unmeasured` | Una línea de calidad no da ningún valor que un test pueda comprobar | Da el número y su unidad, o muévela a Questions |
| `B14_quality_module` | Una línea de calidad nombra un módulo que `modules:` no lista | Nombra un módulo listado, o quita el paréntesis |
| `brief_not_ready` | `propose --from-brief <module>` encontró un error | Ejecuta `--check` y corrige lo que diga |
| `draft_brief_text_lost` | El agente cambió tus notas | No se guardó nada; ejecútalo de nuevo, o escribe tú las secciones |

## Siguiente

Redactar los módulos es el siguiente paso, en el recorrido desde cero:
**[fase 2: del brief a una especificación comprobada →](scratch-2-specify.md)**.
Arrancar el proyecto en sí es la [fase 1](scratch-1-install.md).
