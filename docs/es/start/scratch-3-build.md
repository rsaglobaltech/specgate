<!-- translation-of: f17b2da3acc2 -->
# Desde cero · 3 — Construye el primer requisito

> **La versión corta** de un proyecto nuevo, en seis comandos: [Empezar](../start.md). Esta página es el mismo paso en detalle, con la salida grabada.

<!-- specgate:goal -->
**Cuando termines:** REQ-002 —*un socio reserva una pista para una hora*— implementado, con un
test que lo nombra. Dos maneras: a mano (o con tu agente en el chat), o
entregado al harness, que lo construye sin supervisión en su propia rama.
<!-- specgate:endgoal -->

**Antes de empezar:** la [fase 2](scratch-2-specify.md) está hecha: el change
`draft-bookings` está revisado y sigue abierto.

| Quién | Hace qué en esta fase |
| --- | --- |
| **Tú** | Apruebas el borrador, en tu terminal |
| **Tú** o **tu agente** | Escribís primero el test, después el código hasta que pasa |
| **El harness** (opcional) | El runner de Specgate para trabajo sin supervisión: construye los requisitos pendientes uno a uno, cada uno en su propia rama, y no hace merge de nada salvo que se lo pidas |
| **El gate** | Todavía no: eso es la fase 4 |

## Primero: aprueba el borrador

Leíste el borrador en la fase 2. Aprobarlo te toca a ti, en tu terminal: un
agente no puede, porque la aprobación rechaza una sesión sin terminal
(`approve_needs_person`), y `apply` no entrega nada de un change que nadie
aprobó (`change_not_approved`). Aprobar también sella cada requisito tal como
está: un requisito que cambia después hace fallar el gate hasta que se aprueba de nuevo.

```bash
specgate change approve draft-bookings
```

<!-- specgate:out-scratch-approve:begin — generated; edit the source, not this block -->
```text
$ specgate change approve draft-bookings
  ◆ specgate · change approve   draft-bookings

  ✔  draft-bookings approved on 2026-01-01 — discover.

    + features/bookings/REQ-002.feature   its scenarios, to run before any code
    + features/bookings/REQ-003.feature   its scenarios, to run before any code
    + features/bookings/REQ-004.feature   its scenarios, to run before any code
```
<!-- specgate:out-scratch-approve:end -->

## Antes del primero: haz que un escenario se ejecute

El primer requisito también tiene que montar el proyecto: las dependencias de
test del archivo de build, el runner de BDD o de tests apuntando a `features/`,
y la estructura de carpetas que declara `AGENTS.md`. Hazlo como parte del
primer requisito, no como un paso de "setup" aparte: está hecho cuando un
escenario de ese requisito se ejecuta de verdad (ni omitido ni pendiente) con
tu comando de tests. Cada requisito posterior solo añade código. Si le
entregas el primero a un agente, díselo en el prompt: "also wire the test
runner so this scenario executes".

## Opción A — a mano, primero el test

Lee el requisito y sus escenarios, en el delta del borrador,
`docs/specs/changes/draft-bookings/specs/bookings/spec.md`. En el borrador de
la [fase 2](scratch-2-specify.md#3-abre-el-modulo-y-pasaselo-a-tu-agente),
REQ-002 tiene dos: SCN-002, reservar una pista libre, y SCN-003, un socio ve
sus reservas. El borrador de tu agente puede numerarlos de otra forma: usa sus ids.
Después escribe el test. **Nombra el
requisito en él**: esa mención es todo el enlace entre el test y el
requisito. No hay tabla que editar ni nada que registrar.

```js
// test/bookings.test.js
const test = require("node:test");
const assert = require("node:assert");
const { book, list } = require("../src/bookings");

test("REQ-002 SCN-002: booking a free court lasts one hour", () => {
  assert.deepEqual(book("ana", "centre", "mon-18"), { status: 201, minutes: 60 });
});

test("REQ-002 SCN-003: a member sees their bookings", () => {
  assert.equal(list("ana").length, 1);
});
```

Ejecútalo, míralo fallar, escribe `src/bookings.js` hasta que pase:

```bash
node --test
```

<!-- specgate:out-scratch-node-test:begin — generated; edit the source, not this block -->
```text
$ node --test
✔ REQ-002 SCN-002: booking a free court lasts one hour (12ms)
✔ REQ-002 SCN-003: a member sees their bookings (12ms)
ℹ tests 2
ℹ suites 0
ℹ pass 2
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 1.234
```
<!-- specgate:out-scratch-node-test:end -->

Cualquier lenguaje funciona igual: `// REQ-002` en un test de JUnit, un
docstring de pytest, el nombre de un test de Go. El gate busca el id, no un framework.

## Opción B — entrégaselo al harness

El harness toma el siguiente requisito pendiente, escribe un prompt a partir de
su Gherkin, crea un worktree de git en `harness/REQ-NNN`, ejecuta allí tu
agente y después ejecuta el gate. En verde: el requisito queda aplicado
(Implemented) en su rama.
En rojo: los fallos pasan al siguiente intento. En ambos casos no hace merge:
eso sigue siendo trabajo de una persona, salvo que pidas `--chain`, que hace
merge de cada requisito que pasó en la rama actual.

Mira exactamente qué se le dirá a tu agente, antes de que se ejecute:

```bash
specgate harness prompt REQ-003
```

<!-- specgate:out-scratch-harness-prompt:begin — generated; edit the source, not this block -->
```text
$ specgate harness prompt REQ-003
  ◇  Claude Code may run the test command and no other: `node --test`.

  ◆ specgate · harness run   dry run · 1 requirement(s) would be processed

  Agent         claude --strict-mcp-config --output-format stream-json --verbose --permission-mode acceptEdits --allowedTools "Bash(node --test:*)" -p < {prompt_file} | specgate harness events --from claude
  Setup         none

  REQ-003 · NEEDS_EVERYTHING → branch harness/REQ-003 ────

# Implement REQ-003

You are a coding agent working inside a spec-driven project. Implement exactly one requirement — **REQ-003** — following the project's existing conventions. Do not touch unrelated files.
## The requirement

### Requirement: REQ-003 — A court is never booked twice for the same hour

The system SHALL refuse a booking for a court and hour that is already booked.

> Brief: "A court cannot be booked twice for the same hour."

… 95 more lines
```
<!-- specgate:out-scratch-harness-prompt:end -->

Después ejecútalo con la línea de comandos de tu agente; `{prompt_file}` se
sustituye por el prompt de arriba:

```bash
specgate harness run --req REQ-003 --agent "claude -p < {prompt_file}" --max-attempts 3
```

Los requisitos que esperan una respuesta se omiten a propósito: `harness run --req
REQ-004` dice que espera una respuesta (Needs Clarification) y no arranca ningún agente. La página de inicio
tiene [una grabación de una ejecución completa del harness](../index.html#watch), y
[la guía del harness](../harness.md) cubre agentes, reintentos, concurrencia y coste.

## Revisa y haz merge

Lo hayas escrito tú o el harness, una persona revisa la rama y hace el merge.
El harness deja una rama por requisito precisamente para que cada revisión sea
un requisito.

## Has terminado cuando…

- Los tests de REQ-002 lo nombran y pasan con tu comando de tests.
- El código tiene merge hecho (o está en un commit, si trabajas solo).

## Si algo sale mal

| Ves | Significa | Haz |
| --- | --- | --- |
| `REQ-004 is not a pending requirement — skipped.` | Espera una respuesta, o ya está hecho | `specgate status` dice cuál |
| `No pending requirements. Nothing to do.` | Cada requisito está hecho o espera una respuesta | Abre el borrador del siguiente módulo con `specgate propose --from-brief`, o responde las preguntas abiertas |
| El harness hace commit de `chore(…): attempt FAILED the gate` | Se acabaron los intentos | Lee los fallos en el commit, corrige el spec o el prompt, vuelve a ejecutarlo con `--force` |

## Siguiente

**[Fase 4: demuéstralo →](scratch-4-prove.md)**
