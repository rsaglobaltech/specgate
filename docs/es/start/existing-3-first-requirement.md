<!-- translation-of: 97d0f21ded66 -->
# Proyecto existente · 3 — Cierra el primer requisito

> **La versión corta** de un proyecto existente, en seis comandos: [Empezar](../start.md). Esta página es el mismo paso en detalle, con la salida grabada.

<!-- specgate:goal -->
**Cuando termines:** REQ-004 marcado como `Implemented` —demostrado por un test que ya tenías,
que ahora lo nombra— y su change archivado, de modo que el requisito forma parte de la
especificación.
<!-- specgate:endgoal -->

**Antes de empezar:** la [fase 2](existing-2-specify.md) está hecha: el change
`invoice-rounding` está abierto y su delta contiene REQ-004.

| Quién | Hace qué en esta fase |
| --- | --- |
| **Tú** | Nombras el requisito en su test; apruebas y archivas el change |
| **El gate** | Se niega hasta que un test nombra el requisito y la suite pasa |

## Primero: aprueba el change

Leíste el delta en la fase 2. Aprobarlo te toca a ti, en tu terminal: un
agente no puede, porque la aprobación rechaza una sesión sin terminal
(`approve_needs_person`), y `apply` no entrega nada de un change que nadie
aprobó (`change_not_approved`).

```bash
specgate change approve invoice-rounding
```

<!-- specgate:out-existing-approve:begin — generated; edit the source, not this block -->
```text
$ specgate change approve invoice-rounding
  ◆ specgate · change approve   invoice-rounding

  ✔  invoice-rounding approved on 2026-01-01.

    + features/invoice-rounding/REQ-004.feature   its scenarios, to run before any code
```
<!-- specgate:out-existing-approve:end -->


## 1. Intenta cerrarlo, y mira por qué se niega

```bash
specgate apply REQ-004
```

<!-- specgate:out-existing-apply-refused:begin — generated; edit the source, not this block -->
```text
$ specgate apply REQ-004
  ◆ specgate · apply REQ-004   Implemented

  ✖  REQ-004  REQ-004 has no test that names it yet (TDD-1).  [apply_no_test]
     fix: write a test that names REQ-004 (and its scenario SCN-002), then run specgate apply REQ-004
```
<!-- specgate:out-existing-apply-refused:end -->

El código está ahí y existe un test, pero nada conecta el requisito con él.
Specgate no adivina qué test demuestra qué; un test demuestra un requisito
nombrándolo.

## 2. Nombra el requisito en el test que ya tienes

Una edición: el id en el nombre del test (un comentario también sirve):

<!-- specgate:out-existing-test:begin — generated; edit the source, not this block -->
```text
$ cat test/total.test.js
const test = require("node:test");
const assert = require("node:assert");
const { total } = require("../src/invoices/total");

test("REQ-004: three lines at 21% VAT are rounded to the cent", () => {
  const lines = [
    { quantity: 3, unitPrice: 0.1 },
    { quantity: 1, unitPrice: 19.99 },
    { quantity: 2, unitPrice: 4.55 },
  ];
  assert.equal(total(lines, 0.21), 35.56);
});
```
<!-- specgate:out-existing-test:end -->

Esa mención es el enlace. La **matriz de trazabilidad** —la tabla que enlaza
cada requisito con su escenario, su código y su test— se genera a partir de la
especificación, las etiquetas de los escenarios y los archivos que mencionan
cada id. Nadie la edita a mano, y no hay nada que registrar.

## 3. Aplícalo

```bash
specgate apply REQ-004
```

<!-- specgate:out-existing-apply:begin — generated; edit the source, not this block -->
```text
$ specgate apply REQ-004
  ◆ specgate · apply REQ-004   Implemented

  ✔  Specification   the gate, for REQ-004
  ✔  Tests           node --test

  ✔  REQ-004 → Implemented (1 row updated)
  ·  REQ-004 is delivered on a test that names it: its scenarios were not run. specgate migrate bdd makes the gate run them.

  Next ───────────────────────────────────────────────────
  ➜  specgate archive invoice-rounding
     every requirement of invoice-rounding is delivered
```
<!-- specgate:out-existing-apply:end -->

`apply` ejecutó el gate —`specgate check`— para REQ-004 y toda tu suite antes
de escribir `Implemented`. No hace commit; eso sigue siendo cosa tuya. A partir
de ahora, si alguien rompe el redondeo, `specgate check` falla y nombra el
requisito que se rompió.

## 4. Archiva el change

Cada requisito que añade el change está aplicado, así que el change puede cerrarse:

```bash
specgate archive invoice-rounding
```

<!-- specgate:out-existing-archive:begin — generated; edit the source, not this block -->
```text
$ specgate archive invoice-rounding
  ◆ specgate · archive   invoice-rounding

  ✔  Archived as 2026-01-01-invoice-rounding

    Specs         1 added · 0 modified · 0 removed
    Traceability  1 row(s) added · 0 updated · 0 removed
    Features      0 materialised

  Next ───────────────────────────────────────────────────
  ➜  specgate status
     what each requirement still needs
```
<!-- specgate:out-existing-archive:end -->

`archive` fusiona el delta en la especificación de la capacidad bajo
`docs/specs/capabilities/`, añade REQ-004 a la matriz de trazabilidad y mueve
la carpeta del change a `docs/specs/changes/archive/`. Su escenario ya está en
`features/`: lo escribió `change approve`, así que `Features` dice `0 materialised`. Se niega mientras algún requisito del change
no esté aplicado, y ningún flag se lo salta.

Archiva en tu rama, antes de la pull request: así la especificación y el
código llegan juntos a revisión.

```bash
git add -A && git commit -m "invoice-rounding: REQ-004, an invoice total is rounded to the cent"
```

## El primer requisito suele encontrar un bug

Escribir el ejemplo es donde están las sorpresas. Si el número de tu escenario
y el número que devuelve tu código no coinciden, `apply` se niega con
`the project's tests failed`, y has descubierto cuál es el correcto antes que
un cliente. En los [proyectos piloto](../projects/index.md), los smoke tests
en este punto encontraron una app que no arrancaba con todos los tests en
verde, y una pantalla a la que nadie podía llegar.

## Has terminado cuando…

- `specgate apply REQ-004` imprimió `→ Implemented`.
- `specgate archive invoice-rounding` imprimió `Archived as …`.
- `specgate status` muestra `1 of 1 done`, con REQ-001 aparte, cumplido por tu suite.

## Si algo sale mal

| Ves | Significa | Haz |
| --- | --- | --- |
| `[TDD-1] Test artifact is TBD but status is 'Implemented'` | Ningún archivo nombra `REQ-004` | Pon el id en el nombre del test o en un comentario |
| `not marked Implemented: the project's tests failed. [done_tests_failed]` | La suite está en rojo | Corrige el código o el ejemplo: decide cuál es el correcto |
| `1 coverage finding(s) reported, not failed` | Un test nombra un escenario del requisito, no todos | Con el preset standard es una advertencia (`coverage` en `.specgate/gate.yaml`); nombra también los demás, o nombra solo el requisito |
| `has 1 requirement(s) not delivered yet … [archive_requirements_pending]` | Un requisito del change no está aplicado | Ejecuta el `apply` que nombra la línea fix, y después archiva de nuevo |

## Siguiente

**[Fase 4: pon el gate en CI →](existing-4-ci.md)**
