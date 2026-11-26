<!-- translation-of: b71ff124fbf8 -->
# Desde cero · 4 — Demuéstralo

> **La versión corta** de un proyecto nuevo, en seis comandos: [Empezar](../start.md). Esta página es el mismo paso en detalle, con la salida grabada.

<!-- specgate:goal -->
**Cuando termines:** REQ-002 marcado como `Implemented` —algo que Specgate solo hace después de
que el gate lo haya comprobado—, el gate entero en verde, y una página que
le dice a cualquiera en qué punto está el producto.
<!-- specgate:endgoal -->

**Antes de empezar:** la [fase 3](scratch-3-build.md) está hecha: REQ-002 tiene
un test que lo nombra, y el test pasa.

| Quién | Hace qué en esta fase |
| --- | --- |
| **Tú** | Pides que se aplique el requisito |
| **El gate** (`specgate check`) | Decide: la especificación está completa, un test nombra el requisito y tu suite pasa; si no, no se escribe nada |
| **El informe** | Convierte la matriz de trazabilidad en una página que un product owner puede leer |

## 1. Aplica el requisito — `specgate apply`

```bash
specgate apply REQ-002
```

<!-- specgate:out-scratch-apply:begin — generated; edit the source, not this block -->
```text
$ specgate apply REQ-002
  ◆ specgate · apply REQ-002   Implemented

  ✔  Specification   the gate, for REQ-002
  ✔  Tests           node --test

  ✔  REQ-002 → Implemented (1 row updated)
  ·  REQ-002 is delivered on a test that names it: its scenarios were not run. specgate migrate bdd makes the gate run them.

  Next ───────────────────────────────────────────────────
  ➜  specgate apply REQ-003
     the next requirement
```
<!-- specgate:out-scratch-apply:end -->

Antes de escribir `Implemented`, `apply` ejecutó el gate para REQ-002 y tu
comando de tests. Un test que falta, un `<placeholder>` olvidado en un
escenario o una suite en rojo, y se niega, sin escribir nada. Tampoco hace
commit; haz commit del test, el código y el estado juntos.

## 2. Mira cómo rechaza lo que no está terminado

REQ-004 espera la respuesta del cliente sobre la tarifa por cancelar tarde:

```bash
specgate apply REQ-004
```

<!-- specgate:out-scratch-apply-blocked:begin — generated; edit the source, not this block -->
```text
$ specgate apply REQ-004
  ◆ specgate · apply REQ-004   Implemented

  ✖  REQ-004  not marked Implemented: REQ-004 is waiting for an answer (Needs Clarification).  [done_needs_clarification]
     fix: Answer the question that blocks it in its change's questions.md, remove `status="Needs Clarification"` from its `specgate:trace`, write its test, then run `specgate apply`.
```
<!-- specgate:out-scratch-apply-blocked:end -->

Ese rechazo es lo que importa. Un agente al que se le pide "terminar el módulo
de reservas" no puede cerrarlo inventándose la tarifa; la pregunta sigue
abierta hasta que una persona la responde.

Y el borrador sigue abierto con ella. Archivas un change cuando su código está
hecho —cada requisito que añade, aplicado—, para que la especificación y el
código hagan merge juntos:

```bash
specgate archive draft-bookings
```

<!-- specgate:out-scratch-archive:begin — generated; edit the source, not this block -->
```text
$ specgate archive draft-bookings
  ✖  draft-bookings  Change 'draft-bookings' has 2 requirement(s) not delivered yet: REQ-003, REQ-004.  [archive_requirements_pending]
     fix: specgate apply REQ-003
```
<!-- specgate:out-scratch-archive:end -->

Cuando el cliente responda Q1 y REQ-003 y REQ-004 estén aplicados, el mismo
comando fusiona el borrador en la especificación, la matriz de trazabilidad y
`features/`. Archiva en tu rama y después abre la pull request: la
especificación y su código llegan juntos a revisión.

## 3. Ejecuta el gate entero, lo que ejecutará CI

```bash
specgate check
```

<!-- specgate:out-scratch-check-green:begin — generated; edit the source, not this block -->
```text
$ specgate check
  ◆ specgate · check   court-bookings

  ·  Policy         .specgate/gate.yaml (standard): coverage warning, use_cases warning, scope warning, controls warning
  ↻  docs/specs/actors.md regenerated from its sources
  ·  docs/specs/glossary.md does not define Member — archive adds them as rows to fill
  ·  Ids            not compared with a base — no base branch (pass --base <branch>)
  ✔  Specification   validate --strict
  ✔  Tests           node --test
  ·  Architecture    not checked — specgate config set arch_cmd "<command>"

  ✔  Gate passed — the specification and `node --test`
```
<!-- specgate:out-scratch-check-green:end -->

`check` es `validate --strict` y después tus tests, y después los
[checks de calidad](../quality.md) cuando `quality init` los escribió. Los
requisitos que siguen en `Draft` no deben nada y se cuentan como exentos, así
que un pase nunca oculta su propio alcance.

## 4. Enseña en qué punto está — `specgate report`

```bash
specgate report --out report.html
```

<!-- specgate:out-scratch-report:begin — generated; edit the source, not this block -->
```text
$ specgate report --out report.html
  ◆ specgate · report

  ✔  Wrote report.html

  ░░░░░░░░░░░░░░░░░░░░  0 of 1 implemented   0%
```
<!-- specgate:out-scratch-report:end -->

Una página HTML autocontenida: lo que está hecho, lo que está pendiente, lo
que no tiene test y lo que espera una respuesta, legible sin el repositorio.
Este es el mismo informe sobre uno de los proyectos piloto:

![El informe de specgate para el piloto HealthTech: 23 de 24 requisitos implementados, cada uno con su feature, su test y su código, y uno esperando una respuesta.](../assets/img/report-healthtech.webp)

## Has terminado cuando…

- `specgate apply REQ-002` imprimió `→ Implemented`.
- `specgate check` termina con `✔  Gate passed`.
- `report.html` se abre y muestra tus requisitos.

## Si algo sale mal

| Ves | Significa | Haz |
| --- | --- | --- |
| `[TDD-1] Test artifact is TBD but status is 'Implemented'` | Ningún test nombra el requisito | Menciona `REQ-NNN` en su test: un comentario o el nombre del test |
| `unfilled placeholder in "given <the state before the action>"` | Un escenario aún tiene los `<placeholders>` de la plantilla | Escribe el Given/When/Then real |
| `not marked Implemented: the project's tests failed. [done_tests_failed]` | Tu suite está en rojo | Haz que pase y vuelve a ejecutar `apply` |
| `REQ-004 is waiting for an answer (Needs Clarification). [done_needs_clarification]` | Una pregunta abierta lo bloquea | Consigue la respuesta, regístrala, quita el estado, y después prueba y cierra |

## Siguiente

**[Fase 5: cada día →](scratch-5-every-day.md)**
