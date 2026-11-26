<!-- translation-of: ae7e219a6af0 -->
# Ejemplo práctico: adoptar Specgate en un servicio que ya está en producción

<!-- specgate:note -->
**Una ilustración, no un cliente, pero los comandos son reales.** "Quayside Supplies" y su
`billing-service` son inventados para esta página. Cada comando de abajo se ejecutó con
Specgate 0.18.0 sobre ese servicio, y cada salida es lo que imprimió: recortada
con `…`, nunca editada. Para productos construidos de verdad con Specgate, mira
[los seis pilotos](../projects/index.md).
<!-- specgate:endnote -->

**El servicio:** `billing-service` 2.4.1 — pedidos, facturas y crédito de clientes,
Node.js sin más, seis tests que pasan, un job de CI que ejecuta `npm test`. Cinco
reglas de las que depende el equipo viven solo en el código: los totales se
redondean una vez, un pedido enviado no se puede cancelar, los pedidos grandes
tienen un descuento con tope, un pedido pagado se puede enviar, un cliente no
puede superar su límite de crédito.

**El objetivo:** escribir esas reglas donde un test las demuestre, poner un gate
en cada pull request y empezar el trabajo nuevo desde un requisito, sin parar
al equipo ni reescribir nada.

| Paso | Qué pasa | Comandos |
| --- | --- | --- |
| 1 | Mirar antes de escribir nada | `onboard` |
| 2 | Adoptar en el sitio, gate en verde | `init`, `config set test_cmd`, `check` |
| 3 | Primer comportamiento, demostrado por el test que ya tienes | `new`, `done` |
| 4 | El gate en cada pull request | `ci init`, `status` |
| 5 | Un módulo entero, escrito a partir del código | `change new`, `change validate`, `change archive`, `done` |
| 6 | El trabajo nuevo empieza como un requisito | `new`, `harness prompt`, `report` |

## 1. Mira antes de escribir nada

```text
$ specgate onboard
  1. What this is
     stack:  Node.js
     tests:  npm test
     detected from package.json
  …
  3. Capabilities this codebase already implies
     · Invoices             src/invoices  (2 files)
     · Orders               src/orders  (2 files)
     · Customers            src/customers  (1 files)

     A proposal, not a verdict. Merge, split or rename them.
```

`onboard` no escribe nada. Lee el archivo de build y la estructura de carpetas,
y nombra lo que encontró y dónde. (Sugiere `specgate adopt` como siguiente paso;
`init` hace lo mismo y es el comando que usa el resto de la documentación).

## 2. Adopta en el sitio, gate en verde

```text
$ specgate init
ℹ️ [INFO] Existing code found (package.json) — adopting this repository in place. Nothing in your code is touched.
…
ℹ️ [INFO] write spec.md
ℹ️ [INFO] write features/adoption/baseline.feature
ℹ️ [INFO] write docs/specs/traceability.md
ℹ️ [INFO] write docs/specs/adr/README.md
ℹ️ [INFO] write AGENTS.md
…
ℹ️ [INFO] - Requirements seeded: 3 proposal(s) from the layout — invoices, orders, customers
⚠️ [WARN] This does not certify your code yet — it certifies the skeleton.
```

Cinco archivos, ninguno de ellos código. Ejecuta el gate antes que nada:

```text
$ specgate check
…
⚠  No test command configured — this checked the specification, not the code.
   This project's test command looks like `npm test`. Configure it once:
     specgate config set test_cmd "npm test"
…
✔  Gate passed — the specification
```

Un gate en verde que dice lo que no comprobó. Dile cómo ejecutar los tests, una
vez, y los ejecuta a partir de entonces: en local, en `done` y en CI:

```text
$ specgate config set test_cmd "npm test"
  ✔  test_cmd = npm test
     harness.config.yaml
     `check` and `done` now run it.
$ specgate check
…
ℹ pass 6
ℹ fail 0
✔  Gate passed — the specification and `npm test`
```

**Discute las propuestas.** `init` sembró `REQ-002 Invoices`, `REQ-003
Orders` y `REQ-004 Customers` en `spec.md`. Cada una dice que está "Proposed, not
specified": un nombre de carpeta no es una regla. Quayside borró las tres
secciones: los módulos se escriben como es debido en el paso 5. Los ids borrados
no se reutilizan, así que el siguiente requisito es `REQ-005`.

## 3. Primer comportamiento, demostrado por el test que ya tienes

Elige algo de lo que dependa el equipo y que un test ya ejercite:

```text
$ specgate new "An invoice total is rounded to the cent"
✔  REQ-005 An invoice total is rounded to the cent (Draft)
   spec.md                      ## REQ-005 — rewrite the obligation
   features/an-invoice-total-is-rounded-to.feature @SCN-002 — fill in the <placeholders>
   docs/specs/traceability.md   row linked to the scenario
```

Reescribe la obligación en `spec.md`, y el escenario con los números que el
código produce de verdad, los mismos que en `test/total.test.js`:

```gherkin
Feature: An invoice total is rounded to the cent

  @REQ-005 @SCN-002
  Scenario: Three lines at 21% VAT
    Given an invoice with lines of 3 × 0.10, 1 × 19.99 and 2 × 4.55
    When its total is computed at 21% VAT
    Then the total is 35.56
```

Ahora ciérralo, y mira cómo se niega:

```text
$ specgate done REQ-005
❌ [ERROR] --strict-tdd violations detected:
  [TDD-1] Test artifact is TBD but status is 'Implemented' (scenario: SCN-002)
…
✖  REQ-005 not marked Implemented: validation failed. [done_validate_failed]
```

Todavía nada lo demuestra. El test existe; solo que no dice qué demuestra. Una
palabra en su título es todo el enlace:

```js
test("REQ-005: three lines at 21% VAT are rounded to the cent", () => { … });
```

```text
$ specgate done REQ-005
✔  REQ-005 → Implemented (1 row updated)
```

`done` ejecutó el gate y los seis tests antes de escribir nada. Nadie editó
`traceability.md`: se genera a partir de `spec.md`, las etiquetas de los
escenarios y los tests que mencionan cada id.

**La baseline.** `REQ-001 — Existing behaviour is preserved` sigue pendiente
hasta que un test la nombre. Quayside añadió un smoke test que carga cada
módulo, titulado `REQ-001: the service's modules load`, y la cerró del mismo modo.

## 4. El gate en cada pull request

```text
$ specgate ci init --provider github
ℹ️ [INFO] write .github/workflows/spec-gate.yml
ℹ️ [INFO] ✅ CI gate installed. On every PR/MR the job:
ℹ️ [INFO]   1. runs `specgate check` — the specification, then the tests, as locally
ℹ️ [INFO]      runs your tests: `npm test` (test_cmd)
…
```

El `ci.yml` existente se queda; el gate es un segundo job. A partir de aquí, un
pull request que rompe una regla demostrada, o que marca como terminado algo que
ningún test demuestra, falla.

## 5. Un módulo entero, escrito a partir del código

<!-- specgate:note -->
Registrado con Specgate 0.18.0. Hoy los mismos pasos son: propose → una persona aprueba el change (`specgate change approve`) → construir y aplicar cada requisito → archive.
<!-- specgate:endnote -->

Un requisito cada vez sirve para corregir un bug. Para un módulo, abre un
change: se revisa como un solo pull request y se archiva en la especificación
de una vez.

```text
$ specgate change new describe-orders --capability orders
  ✔ Change describe-orders created (lite · REQ ids REQ-006…REQ-008 reserved)
    + docs/specs/changes/describe-orders/change.yaml
    + docs/specs/changes/describe-orders/proposal.md
    + docs/specs/changes/describe-orders/tasks.md
    + docs/specs/changes/describe-orders/specs/orders/spec.md
```

El delta se lee de `src/orders` y sus tests, no se inventa. Uno de los tres
requisitos:

```markdown
### Requirement: REQ-007 — Large orders get a capped discount

The system SHALL take 5% off an order of 500.00 or more, never more than 100.00.

#### Scenario: The cap applies

- GIVEN an order with a net of 2400.00
- WHEN its discount is computed
- THEN the discount is 100.00
```

```text
$ specgate change validate describe-orders
  ✔ describe-orders (1 delta(s))
$ specgate change archive describe-orders
  ✔ Archived as 2026-10-11-describe-orders
    specs:        3 added · 0 modified · 0 removed
    traceability: 3 row(s) added · 0 updated · 0 removed
    features:     3 materialised
```

Los tres tests de `test/orders.test.js` reciben sus ids en el título, y una sola
ejecución cierra los tres:

```text
$ specgate done REQ-006 REQ-007 REQ-008
✔  REQ-006 → Implemented
✔  REQ-007 → Implemented
✔  REQ-008 → Implemented
   3 of 3 closed; the project's tests ran once.
```

## 6. El trabajo nuevo empieza como un requisito

Finanzas pide algo nuevo: un cliente con una factura vencida no debe poder hacer
un pedido. Entra primero como requisito —`specgate new`, luego la obligación
("más de 30 días después de su fecha de vencimiento") y un escenario con valores
reales—. Se queda en `Draft` hasta que se construye, así que el gate lo exime:

```text
$ specgate check
ℹ️ [INFO] - Strict TDD gate: passed (1 row(s) exempt — still Draft, so not checked)
✔  Gate passed — the specification and `npm test`
```

Alguien lo construye, a mano o con un agente. `harness prompt` muestra
exactamente lo que recibiría un agente; `harness run --req REQ-009 --agent "claude -p < {prompt_file}"`
lo construye en su propia rama y nunca hace merge. Mira [el harness](../harness.md).

```text
$ specgate harness prompt REQ-009
REQ-009 (NEEDS_EVERYTHING) → branch harness/REQ-009
# Implement REQ-009
…
- Scenario ID: SCN-003
- Test artifact (write this first — TDD): TBD
```

Y el product owner recibe una página:

```text
$ specgate report --out report.html
📊 Wrote report.html — 83.3% implemented (5/6).
$ specgate status
  Requirements  6 total · 5 done · 1 pending
  To do
    REQ-009   A customer with an overdue invoice cannot p…  a test and code
  Next  specgate done REQ-009  — once a test mentions REQ-009 — that mention is the link; done checks first
```

## Cada día a partir de entonces

- **Una corrección de bug** añade el comportamiento que corrige: `specgate new`,
  su escenario, el test de regresión que lo nombra, `specgate done`.
- **Un módulo que alguien está a punto de cambiar** se escribe primero, como un
  change.
- **El trabajo nuevo** empieza como un requisito; `status` siempre nombra el
  siguiente comando.
- **Nadie rellena todo hacia atrás.** El módulo de clientes (límite de crédito)
  sigue sin escribir, y no pasa nada: el gate protege lo que está escrito y dice
  claramente lo que no cubre.

## Qué vigilar

| Qué | Por qué importa |
| --- | --- |
| Las propuestas sembradas son suposiciones a partir de nombres de carpeta | Bórralas o reescríbelas; no las marques como terminadas. Su texto aún menciona `req link`: no hace falta, un test que nombra el id es el enlace. |
| En `spec.md` → *Context* salió `Domain: general`, `API style: REST with DTO boundaries` | Valores por defecto, no leídos del código. Corrígelos; los agentes leen este archivo. |
| Un `check` en verde sin `test_cmd` solo comprobó la especificación | Lo dice. Fija `test_cmd` el primer día. |
| Las filas en Draft están exentas del gate | Correcto para trabajo en curso; incorrecto si un requisito se queda en Draft para siempre. `status` las lista. |
| `REQ-001` (la baseline) nunca se cierra sola | Nómbrala en un smoke test que cargue o arranque el servicio. |

## Siguiente

- [Proyecto existente · 1 Adoptar](../start/existing-1-adopt.md) — el mismo
  camino, una página corta por fase
- [Escribir buenos requisitos y escenarios](../writing-specs.md)
- [Pon el gate en CI](../validating.md)
