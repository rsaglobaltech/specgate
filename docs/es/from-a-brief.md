<!-- translation-of: 228816b42355 -->
# Del brief de un cliente a una especificación

Un proyecto suele empezar como un brief: una página, un documento, unas
capturas de pantalla. Este es el camino de esa página a requisitos con los que
el gate y el harness pueden trabajar: el mismo con el que se construyeron los
[seis productos piloto](projects/index.md), a partir de briefs tan distintos
como un documento de reservas detallado y una descripción de cinco líneas de
una tienda a crédito.

Al final tendrás un **borrador**, un change cuyos requisitos se escribieron a
partir del brief y se comprobaron contra él, revisado por una persona y listo
para construir. Los pasos 1 a 3 convierten el brief en ese borrador; el paso 4
es el mismo ciclo que cualquier otro change: `specgate apply` con cada
requisito a través del gate, y luego `specgate archive` del borrador
([ADR-0035](specs/adr/0035-four-verbs-one-lifecycle.md)).

**Necesitas:** un proyecto con Specgate configurado
([Primeros pasos](getting-started.md)) y el brief del cliente. Un agente de
código es opcional, pero ahorra casi toda la escritura.

¿Tu trabajo llega como historias de Jira con criterios de aceptación en lugar
de un brief? Usa el camino del ticket: [Desde un ticket de Jira](from-a-ticket.md).

<!-- specgate:diagram lifecycle -->

## 1. Guarda el brief en el repositorio

Guárdalo como `docs/brief.md`, tal como lo escribió el cliente. Añade un front
matter que diga quién usa el producto y cómo, y una sección por módulo con sus
reglas, ejemplos y preguntas. `specgate propose --from-brief` explica cada
campo, `specgate propose --from-brief --agent "claude -p"` hace que tu agente
proponga los campos y después las secciones a partir del texto del cliente, y
`specgate propose --from-brief --check` comprueba el brief antes de redactar
nada. Paso a paso: [Escribe el brief](start/write-the-brief.md).

Dos secciones dicen lo que los módulos no dicen. `## Why` da el problema, los
objetivos y un éxito que puedas medir: un Why sin número recibe la advertencia
`B15_why_unmeasured`. `## Quality` dice lo bien que debe funcionar el
producto, una línea por necesidad que empieza con su característica de
ISO/IEC 25010 —
`- performance efficiency (reservas): A slot is confirmed in under 2 seconds.`
— y cada línea se convierte en un requisito no funcional en el borrador del
módulo que nombra, o del primer módulo cuando no nombra ninguno. Una línea que
ningún test puede comprobar detiene el borrador (`B14_quality_unmeasured`).
Paso a paso: [Calidad](start/write-the-brief.md#paso-8-calidad-3-minutos).

Una herramienta que edita el brief como un formulario —specgate-studio— lo lee
con `specgate propose --from-brief --form --json`, cada campo con su línea, y
lo vuelve a escribir con `--form <file>`: solo se reescriben los campos y las
listas de tarjetas que cambiaron; cada uno de los demás bytes del archivo
queda como estaba.

```markdown
---
product: Bookings for local businesses
surfaces: [api, web]
actors:
  - { name: Cliente, surfaces: [api, web] }
  - { name: Propietario, surfaces: [api, web] }
modules: [calendario, reservas, cupones]
---

# The brief, unchanged

…

## Module: reservas

Rules

- A slot is booked by one Cliente at a time.

Examples

- The one where Ana books the 10:00 slot of "Corte de pelo".

Questions

- Can a Cliente book two slots in a row?
```

## 2. Redacta un módulo

```bash
specgate propose --from-brief            # the brief's modules: where each stands, which is next
specgate propose --from-brief reservas   # opens draft-reservas, linked to the brief
```

Abrir un módulo crea el borrador, una carpeta de change que se mantiene aparte
de la especificación hasta que una persona la revisa, y escribe en ella
`DRAFTING.md`. Ese archivo contiene la sección del módulo en el brief con sus
valores y preguntas, los ids reservados, un escenario por escribir por cada
actor y superficie del front matter, y los formatos de abajo. Es el prompt
para tu agente. Dile a tu agente
`Draft the reservas module: follow docs/specs/changes/draft-reservas/DRAFTING.md`,
o deja que Specgate lo llame:

```bash
specgate propose --from-brief reservas --agent "claude -p"
```

El prompt le llega al agente por la entrada estándar, o en un archivo cuando el
comando contiene `{prompt_file}`. Todo lo que el agente escriba fuera de la
carpeta del borrador se deshace —un archivo que tú habías cambiado vuelve a tu
versión— y el borrador se comprueba cuando el agente termina. En Claude Code,
`/specgate:draft reservas` hace lo mismo desde dentro de la sesión.

El agente escribe el delta en `specs/<module>/spec.md`, y junto a él van dos
archivos:

- **`assumptions.md`**: cada valor que el brief no da: precios, límites,
  textos de botones, códigos de estado. Una fila nombra los requisitos o
  escenarios que lo usan, uno a uno o como rango (`REQ-004..REQ-010`).
- **`questions.md`**: lo que el brief no puede responder, y los requisitos
  que bloquea cada pregunta. Un requisito bloqueado lleva
  `status="Needs Clarification"` en su trace; el harness y `apply` lo
  rechazan hasta que alguien responda, y `status` lo lista bajo "Waiting for an
  answer" con la pregunta que lo bloquea.

Lo mismo desde el [studio](studio.md): su sección Brief escribe el brief como
un formulario, y su sección Changes redacta cada módulo en segundo plano con el
agente que elijas (`--profile <name>` en la terminal).

## 3. Comprueba el borrador

Ejecuta de nuevo el mismo comando: sobre un borrador que ya existe, es la
comprobación:

```bash
specgate propose --from-brief reservas
```

(`specgate propose --from-brief --check <change-id>` ejecuta la misma lista de
comprobación sobre cualquier change; `--check` solo comprueba el brief en sí.)

| Código | Pregunta                                                                                                                                       |
| ------ | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| D1     | cada requisito tiene un escenario                                                                                                              |
| D2     | cada requisito tiene un tipo (`functional`, `non-functional`, `business-rule`)                                                                 |
| D3     | las superficies de cada actor tienen un escenario de ese actor: una llamada a la API y una pantalla. `surfaces=web` en un requisito lo acota (un menú no tiene API) |
| D4     | un requisito no funcional que promete una cantidad da un número con su unidad                                                                  |
| D5     | una regla que cita una ley, norma o contrato nombra su fuente (`Source:` y un enlace)                                                         |
| D6     | cada valor de un escenario está en el brief, en la especificación del proyecto, en `assumptions.md` o en su propia obligación con fuente        |
| D7     | cada pregunta abierta bloquea un requisito, y ese requisito espera ("none" dice que no bloquea nada); "TBD" o "se decidirá" no es una respuesta |
| D8     | el borrador es lo bastante pequeño para revisarlo (25 requisitos por defecto)                                                                  |
| D9     | cada escenario cumple las reglas que aplicará el gate del harness (títulos, Given/When/Then)                                                   |
| D10    | ningún id de requisito o escenario que ya sea de otro requisito                                                                                |
| D12    | un actor que actúa sobre un id (`…/{id}/…`) tiene un escenario que lo lista o lo crea, o una suposición dice de dónde viene                     |

D6 es la que mantiene honesto un borrador: con un brief vago lista casi todos
los valores, y esa lista es la conversación que hay que tener con el cliente.

D12 detecta un hueco que todos los pilotos encontraron solo al ejecutar el
producto: cada escenario era correcto por sí solo, y aun así un operador podía
liquidar una transferencia por su id sin ninguna forma de ver qué
transferencias estaban pendientes.

D12 se cumple cuando el mismo actor tiene una de estas cosas, en el borrador o
en la especificación del proyecto:

- un `GET` sobre la colección;
- el `POST` que crea el elemento;
- una lista anidada bajo su padre con el mismo nombre
  (`GET /api/eventos/{id}/sesiones` para `POST /api/sesiones/{id}/sala`);
- una fila en `assumptions.md`, que nombre el requisito y la ruta de la
  colección, y diga de dónde viene el id. Úsala cuando el id le llega al actor
  fuera de la API (un cliente le dicta su IBAN al cajero) o a través de una
  lista con otro nombre (una agenda).

El actor es el que nombra el paso antes de la llamada o, si no, el actor del
requisito. Para un requisito `MODIFIED`, también cuentan las filas de
`assumptions.md` del change archivado que lo escribió por primera vez.

D6 también acepta un valor que la propia obligación del requisito declara bajo
una línea `Source:`: los "24 caracteres" de una norma ISO citada no necesitan
una fila de suposición.

### Responder una pregunta

Una pregunta respondida lleva una columna `Answer` (`Respuesta` también
sirve), o una línea bajo la tabla como `Answer (Q1): free shipping from 50 €`:

```markdown
| #   | Question                         | Blocks  | Answer               | Status   |
| --- | -------------------------------- | ------- | -------------------- | -------- |
| Q1  | From what amount is it free?     | REQ-004 | From 50 €, per order | answered |
| Q2  | Should it export a backup later? | none    |                      | open     |
```

Después, por cada requisito que la pregunta bloqueaba:

1. Quita `status="Needs Clarification"` de su `specgate:trace`. Nada lo quita
   por ti: la persona que respondió decide que está listo.
2. Escribe la respuesta en su texto y sus escenarios, y registra cualquier
   valor que el brief siga sin dar como una fila de `assumptions.md` que nombre
   el requisito.
3. Ejecuta `specgate propose --from-brief <module>` de nuevo hasta ver
   **Ready to review**.

Una respuesta que aplaza la decisión ("TBD", "pending", "se decidirá") deja la
pregunta abierta. Una pregunta de la que nada del borrador depende lo dice con
`none` (o `—`, `ninguno`) en su columna Blocks: se queda en `questions.md`
como advertencia, y nada la espera. Una celda Blocks vacía se sigue
rechazando. Una columna `Status` es para el lector; la lista de comprobación
lee la respuesta. El studio, `specgate questions` y la lista de comprobación
leen una respuesta de la misma forma —la celda o la línea `Answer (Qn):`— y el
botón **The spec says it** del studio quita `Needs Clarification` de los
requisitos que la pregunta retenía en cuanto su texto dice la respuesta.

## 4. Revisa, aplica y archiva

Un borrador es un change como cualquier otro, y su revisión es el pull
request. Cuando la lista de comprobación dice **Ready to review**, una persona
lee los requisitos y `assumptions.md` con quien conoce el negocio, responde lo
que puede, y los requisitos se construyen de uno en uno:

```bash
specgate status                    # the draft's requirements, listed while it is open
specgate apply                     # the next one: refused until a test names it, then the gate
specgate archive draft-reservas    # once every requirement in it is Implemented
```

Deja un requisito en Draft hasta que exista su test. Todo estado posterior a
Draft, incluido Approved, debe un test según TDD-1, así que
`apply --status Approved` rechaza un requisito que ningún test nombra; marcado
a mano, pondría en rojo `validate --strict`, y todos los gates del harness,
para todo el proyecto.

Mientras el borrador está abierto, sus requisitos ya cuentan: `status` los
lista, `apply`, `check` y `harness run` juzgan el proyecto tal como quedará
después de archivar, y `apply` escribe cada estado en el delta del borrador.
Nada se escribe en `docs/specs/capabilities/` antes de archivar.

`archive` se niega mientras quede un requisito pendiente
(`archive_requirements_pending`, con `specgate apply REQ-…` como corrección),
y `--force` no se salta eso. Un change abierto desde un brief (`brief:` en
`change.yaml`) también necesita que su lista de comprobación pase; `--force`
solo se salta la lista de comprobación, y lo dice en la revisión. Un borrador
no tiene `tasks.md` que marcar.

Archivar fusiona los requisitos en `docs/specs/capabilities/`, añade sus filas
a la matriz y escribe un archivo feature por requisito: la especificación y el
código que describe llegan en el mismo pull request. Un test que refuta el
texto de la especificación se corrige en el mismo borrador, no en un segundo
change. Después, `specgate propose --from-brief` nombra el siguiente módulo.
`specgate harness run` puede entregar los requisitos en lugar de una persona,
uno por worktree.

## Escribir en español

Escribe los escenarios con `DADO / CUANDO / ENTONCES / Y`; el cuerpo del
requisito mantiene `SHALL` (o `DEBE`). Archivar escribe Gherkin en español
(`# language: es`, `Característica`, `Escenario`), y todas las reglas de
arriba leen ambos idiomas.

## Lo que la lista de comprobación no ve

Comprueba que existe un escenario para cada superficie y (D12) que un actor
puede llegar a los ids sobre los que actúa, no que el borrador pida todo. En
todos los pilotos, una acción con solo un escenario de API (subir una foto,
añadir al carrito) se construyó como una API sin botón, y el gate siguió en
verde. Ejecuta el producto una vez, a mano o headless, después de cada módulo:
ahí es donde se ven esos huecos, y cada uno se convirtió en un change breve de
seguimiento.

El diseño está en [ADR-0029](specs/adr/0029-a-brief-becomes-a-draft-change-not-a-spec.md)
y [draft-from-brief](specs/draft-from-brief.md).

## Siguiente

- [Escribe el brief](start/write-the-brief.md): el front matter y las secciones del brief, campo por campo
- [Desde un ticket de Jira](from-a-ticket.md): las mismas comprobaciones, con una historia de Jira como fuente
