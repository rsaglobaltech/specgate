<!-- translation-of: 3aeb9e7324cd -->
# Proyecto existente · 2 — Escribe aquello de lo que dependes

> **La versión corta** de un proyecto existente, en seis comandos: [Empezar](../start.md). Esta página es el mismo paso en detalle, con la salida grabada.

<!-- specgate:goal -->
**Cuando termines:** un comportamiento del que el negocio ya depende, escrito como
requisito con un ejemplo concreto, en un change abierto: lo primero que el
gate puede exigirle a tu código.
<!-- specgate:endgoal -->

**Antes de empezar:** la [fase 1](existing-1-adopt.md) está hecha: Specgate está
adoptado y `specgate check` pasa.

| Quién | Hace qué en esta fase |
| --- | --- |
| **Tú** | Eliges el comportamiento; escribes el requisito y su ejemplo |
| **Tu agente** | Puede escribir ambos a partir del código y los tests; tú revisas |
| **Specgate** | Abre el change y reserva sus ids de requisito |

## 1. Mira desde dónde empiezas

```bash
specgate status
```

<!-- specgate:out-existing-status:begin — generated; edit the source, not this block -->
```text
$ specgate status
  ◆ specgate · status   invoicing

  Requirements  ░░░░░░░░░░░░░░░░░░░░  0 of 0 done

  ·  REQ-001 Preserve existing behaviour: your test suite holds it on every check.
     To close it, name REQ-001 in a test that starts the product.

  Next ───────────────────────────────────────────────────
  ➜  specgate new "<a behaviour you rely on>"
     only the adoption baseline is specified — add one requirement your code already meets
```
<!-- specgate:out-existing-status:end -->

El baseline de adopción, REQ-001, es de momento el único requisito, y tu suite
de tests ya lo cumple: `status` lo dice, y no lo cuenta como trabajo pendiente.
Las áreas que la adopción encontró en tu
estructura —Invoices, Customers— están listadas en `docs/specs/adoption.md` con
sus carpetas y sus tests: un mapa del que elegir, no requisitos. Empieza por
algo más pequeño que un área.

## 2. Elige un comportamiento que odiarías romper

No un módulo: una regla. La que haría llamar a un cliente. Aquí: *el total de
una factura se redondea al céntimo*.

## 3. Abre un change — `specgate propose`

Un **change** es una carpeta que guarda un trabajo hasta que se construye:
`discover.md` (por qué), `design.md` (cómo), `tasks.md`, y un **delta**: los
requisitos y escenarios que el change añade o modifica. Abre uno para la regla
de redondeo:

```bash
specgate propose invoice-rounding
```

<!-- specgate:out-existing-propose:begin — generated; edit the source, not this block -->
```text
$ specgate propose invoice-rounding
  ◆ specgate · propose   invoice-rounding

  ✔  Change invoice-rounding created · lite · REQ ids REQ-002…REQ-004 reserved

    + docs/specs/changes/invoice-rounding/change.yaml
    + docs/specs/changes/invoice-rounding/discover.md
    + docs/specs/changes/invoice-rounding/design.md
    + docs/specs/changes/invoice-rounding/tasks.md
    + docs/specs/changes/invoice-rounding/specs/invoice-rounding/spec.md

  Next ───────────────────────────────────────────────────
  ➜  specgate apply
     after you write the delta, a test that names each requirement, and the code
```
<!-- specgate:out-existing-propose:end -->

El change reserva un rango de ids de requisito, para que dos changes en curso
nunca elijan el mismo. Todavía no cambia nada en `spec.md` ni en `features/`.

## 4. Escribe el delta

`propose` escribió una plantilla de `<placeholders>`. Sustitúyela por el
requisito real: una frase que dice lo que el sistema SHALL hacer, y un
escenario con un ejemplo real; los números que tu test existente ya usa son un
buen comienzo. Puedes escribirlo tú, o pedirle a tu agente que lo escriba a
partir del código y el test, y revisar lo que escribió.

<!-- specgate:out-existing-delta:begin — generated; edit the source, not this block -->
```text
$ cat docs/specs/changes/invoice-rounding/specs/invoice-rounding/spec.md
# Delta — invoice-rounding

## ADDED Requirements

### Requirement: REQ-004 — An invoice total is rounded to the cent

<!-- specgate:trace kind=business-rule -->

The system SHALL round an invoice total, VAT included, to the cent.

#### Scenario: SCN-002 — Three lines at 21% VAT

- GIVEN an invoice with lines of 3 × 0.10, 1 × 19.99 and 2 × 4.55
- WHEN its total is computed at 21% VAT
- THEN the total is 35.56
```
<!-- specgate:out-existing-delta:end -->

- `REQ-004` es uno de los ids que reservó el change, `REQ-002…REQ-004`; sirve
  cualquiera de ellos. `SCN-002` nombra el escenario (`SCN-001` es el escenario
  baseline de la adopción).
- `kind=business-rule` dice qué tipo de requisito es: `functional`,
  `non-functional` o `business-rule`.
- Un escenario con números es una afirmación que alguien puede comprobar.
  "Los totales son correctos" no lo es.

Marca las primeras tareas del `tasks.md` del change a medida que las termines.

## 5. Míralo en curso

```bash
specgate status
```

<!-- specgate:out-existing-status-change:begin — generated; edit the source, not this block -->
```text
$ specgate status
  ◆ specgate · status   invoicing

  Requirements  ░░░░░░░░░░░░░░░░░░░░  0 of 1 done

  To do ──────────────────────────────────────────────────
    ○ REQ-004  An invoice total is rounded to the cent  a test and code

  ·  REQ-001 Preserve existing behaviour: your test suite holds it on every check.
     To close it, name REQ-001 in a test that starts the product.

  Next ───────────────────────────────────────────────────
  ➜  specgate change approve invoice-rounding
     invoice-rounding waits for a person to approve it, at their terminal — apply delivers nothing before
```
<!-- specgate:out-existing-status-change:end -->

`status`, `check` y `apply` leen también los requisitos de un change abierto:
REQ-004 está **en curso**: especificado, aún no construido ni fusionado en la
especificación. Se une a la especificación cuando archivas el change, después
de demostrarlo, en la siguiente fase.

## El módulo entero, cuando estés listo

Para describir todo `src/invoices` en lugar de una regla cada vez, abre un
change para la capacidad y deja que tu agente escriba su delta a partir del
código y los tests:

```bash
specgate propose describe-invoices --capability invoices
specgate propose --from-brief --check describe-invoices
```

El segundo comando aplica la checklist de redacción al delta: cada requisito
tiene un escenario y un tipo, ningún escenario se queda como plantilla, ningún
id se usa dos veces. Revísalo con quien conozca el negocio, y después
constrúyelo y archívalo como cualquier otro change. Su área en
`docs/specs/adoption.md` es un mapa, no un requisito: no hay nada que quitar de
la especificación.

## Has terminado cuando…

- `docs/specs/changes/invoice-rounding/` contiene REQ-004 con una frase real,
  no la plantilla.
- Su escenario tiene un GIVEN/WHEN/THEN concreto y ningún `<placeholder>`.
- `specgate status` lista REQ-004.

## Si algo sale mal

| Ves | Significa | Haz |
| --- | --- | --- |
| `Change invoice-rounding — delta not written yet, not judged until it is` | El delta sigue siendo la plantilla, así que REQ-004 no aparece | Escribe el requisito y su escenario |
| `unfilled placeholder in "given <precondition>"` | Un paso de un escenario aún tiene el texto de la plantilla | Escribe los pasos reales |

## Siguiente

**[Fase 3: cierra el primer requisito →](existing-3-first-requirement.md)**
