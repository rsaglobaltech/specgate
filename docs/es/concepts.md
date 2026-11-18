<!-- translation-of: 2d8b1d5c5c9c -->
# Cómo piensa Specgate

Seis ideas explican todo lo que hace la CLI. Léelas una vez y cada comando,
error y flag tendrá una razón que puedes predecir.

## 1. Un requisito es una frase que puede ser falsa

Un requisito vive en `spec.md` (o en el spec de una capacidad bajo
`docs/specs/`) como una sección numerada:

```markdown
## REQ-007 — Customers download invoices as PDF

<!-- specgate:trace status=Implemented -->

A customer with a paid invoice MUST be able to download it as a PDF from the
invoice page, within two seconds, with the invoice number in the file name.
```

La prosa es para las personas. El comentario `specgate:trace` es para la
herramienta: guarda el estado y cualquier enlace que la herramienta no puede
inferir. Escribes la sección en el delta de un change (`specgate propose`), o
`specgate new` la escribe en `spec.md` con una frase de borrador para que la
reescribas; `specgate apply` registra el estado cuando el gate pasa.

Un requisito es útil cuando dos personas podrían probarlo y coincidir en la
respuesta. "Las facturas son fáciles de obtener" es un deseo; el párrafo de
arriba es un requisito.

## 2. Un escenario lo vuelve ejecutable

Cada requisito tiene al menos un escenario Gherkin, etiquetado con sus ids:

```gherkin
@REQ-007 @SCN-007
Scenario: A paid invoice downloads as a PDF
  Given a customer with a paid invoice INV-2041
  When they download it from the invoice page
  Then they receive "INV-2041.pdf" within 2 seconds
```

El escenario es el criterio de aceptación. Gherkin, y no prosa, porque un
runner puede ejecutarlo, y porque el gate puede comprobar cosas sobre él que no
puede comprobar sobre la prosa: que tiene pasos, que sus palabras clave son
las que Cucumber reconoce, que un `Outline` tiene `Examples`.

## 3. Una mención es un enlace

No hay nada que declarar. **Un test o un archivo de código que menciona
`REQ-007` queda enlazado a él**:

```js
// REQ-007 SCN-007 — a paid invoice downloads as a PDF
test("a paid invoice downloads as a PDF", async () => { /* … */ });
```

Ese es todo el modelo de enlaces. Renombra el test y el enlace se mueve con
él; bórralo y el requisito pierde su test, cosa que el gate entonces reporta.

## 4. La matriz se genera, nunca se edita

`docs/specs/traceability.md` tiene una fila por escenario: requisito,
escenario, archivo feature, test, código, estado. Cada columna ya está dicha en
otro lugar, así que se **calcula** a partir de esas fuentes:

<!-- specgate:diagram traceability-chain -->

| Columna | Viene de |
|---|---|
| Requisito, título | las secciones `## REQ-NNN` en `spec.md` y en los specs de capacidades |
| Escenario, archivo feature | las etiquetas `@REQ-NNN @SCN-NNN` en `features/**/*.feature` |
| Test, código | los archivos que mencionan `REQ-NNN` |
| Estado | el comentario `specgate:trace`, escrito por `specgate apply` |

`specgate check` y `specgate apply` la regeneran antes de juzgar.
`specgate validate` —lo que ejecuta CI— falla con `matrix_stale` cuando la
copia en el repositorio ya no coincide con sus fuentes. Sigue en el
repositorio porque la leen personas y herramientas; simplemente no tiene autor.

## 5. Un estado es una promesa, y el gate la cobra

El gate es estricto, pero a un requisito solo le pide lo que promete su
estado:

| Estado | Lo que debe |
|---|---|
| `Draft` | Nada, salvo que sus escenarios no pueden mentir: ningún escenario sin pasos, ninguna palabra clave que Cucumber leería como prosa, ningún `Outline` sin `Examples`. |
| Más allá de `Draft` (`Approved`, `In Dev`, `In Review`, …) | Un test que lo mencione (y, en una matriz mantenida a mano, un id de escenario). |
| Entregado (`Implemented`, `Verified`, `Released`) | Todo lo anterior, y además cada archivo al que apunta existe y su escenario no tiene pasos `<placeholder>`. |
| `Deprecated` | Sus archivos pueden haber desaparecido; no debe nada. |

Por eso el gate está en verde el día que lo adoptas y significa más con cada
requisito que entregas. También por eso nunca miente sobre su propio alcance:
una ejecución en verde dice cuántas filas quedaron exentas:

```text
- Strict TDD gate: passed (3 row(s) exempt — still Draft, so not checked)
```

`specgate apply REQ-007` es la forma en que un requisito llega a un estado
entregado. Se niega mientras ningún test nombre el requisito y luego ejecuta el
gate para él: si el gate fallaría, no se escribe nada. (`--no-check` se salta
el gate, para el caso raro en que está equivocado; dilo en el pull request).

## 6. Un gate, un nombre

Hay exactamente un gate: `validate --strict` sobre la especificación y luego
tu check de arquitectura, tus tests y tus [checks de calidad](quality.md)
cuando están configurados.
`specgate check` lo ejecuta, y también todo lo demás.

| Dónde | Qué se ejecuta |
|---|---|
| Tu máquina, antes de un PR | `specgate check`: el gate y luego tus tests si hay un comando de tests configurado |
| Al entregar un requisito | `specgate apply`: el gate para ese requisito y luego el estado |
| CI | el spec gate que instalan `init` y `adopt` (`specgate ci init` lo vuelve a escribir): `specgate check` con el JDK o Node del proyecto configurado; `specgate ci status` dice qué comprueba |
| Un agente | el comando `/specgate:check`, el hook `Stop`, el harness |

Un gate que era ligeramente distinto en cada lugar aprobaba el trabajo en uno
y lo rechazaba en el siguiente. Ahora un verde en un lugar es un verde en
todos.

## Alrededor del núcleo

Tres cosas se construyen sobre esas seis ideas. La primera es el ciclo diario;
las otras dos no hacen falta el primer día.

**Changes.** El trabajo nuevo y los cambios a lo que ya está publicado pasan
por un change: una carpeta bajo `docs/specs/changes/<id>/` con una propuesta y
un delta, que lista solo los requisitos y escenarios que se mueven, nunca una
copia del spec. Mientras está abierto, sus requisitos cuentan: `status` los
lista, `apply` los entrega uno por uno, `check` juzga el proyecto tal como
quedará después del archive. `specgate archive <id>` hace merge en el árbol de
specs y escribe los archivos feature cuando todos sus requisitos están en
`Implemented`. Un change se archiva cuando su código está terminado, en su
rama, para que el spec y el código lleguen en un solo pull request
([ADR-0035](specs/adr/0035-four-verbs-one-lifecycle.md)).
→ [Cambiar un requisito ya publicado](reviewing-changes.md)

**Capas.** Un change tiene tres, cada una con su responsable: `discover.md`, de
producto: lo que necesita el negocio, sus criterios de aceptación, sin
tecnología; `design.md`, del arquitecto: el cómo, respondiendo a cada
criterio; `tasks.md`, del desarrollador: el trabajo, con cada tarea nombrando
su requisito. Producto revisa la historia, el arquitecto el diseño, y la
historia no se mueve mientras el diseño cambia
([ADR-0044](specs/adr/0044-the-three-layers-of-a-change.md)).

Un change viene de uno de tres lugares:

| Origen | Comando | Guía |
|---|---|---|
| Un comportamiento que describes tú | `specgate propose <change-id>` | [Proponer un change](start/existing-2-specify.md) |
| Un brief: un producto nuevo, o un área grande de uno | `specgate propose --from-brief` | [Desde el brief de un cliente](from-a-brief.md) |
| Un ticket de Jira con criterios de aceptación | `specgate propose --from-ticket <KEY>` | [Desde un ticket de Jira](from-a-ticket.md) |

Un change que viene de un brief o de un ticket es un **borrador**: se comprueba
contra su texto de origen, y cada valor que usa debe venir de ese texto o
figurar como supuesto.

**Packs de dominio.** Un conjunto versionado y validado por esquema de
requisitos y escenarios para un dominio (multi-tenancy, pagos, …), instalado
como una dependencia, fijado por digest en `.specops.lock` y actualizado
mediante un diff revisable. → [Packs de dominio](domain-packs.md)

**El harness.** Entrega un requisito pendiente a la vez a cualquier agente de
código en su propio git worktree, ejecuta el gate sobre el resultado y marca el
requisito como `Implemented` solo cuando pasa. Nunca hace merge salvo que pidas
una cadena (`--chain`), y `specgate studio` lo muestra trabajando en `/live`.
→ [El harness](harness.md)

Antes de que exista un change, `specgate explore` escribe un brief de dónde
está el proyecto para que tú o tu agente piensen con él; `specgate onboard
--tour` ejecuta el ciclo completo sobre una copia temporal de tu repositorio.
→ [Referencia de comandos](commands.md#starting-a-project)

## Vocabulario

| Término | Significado |
|---|---|
| **Supuesto** (*assumption*) | Un valor que usa un borrador y que su brief o ticket no indica (un precio, un límite, una etiqueta), listado en el `assumptions.md` del change junto con los requisitos que lo usan. |
| **Brief** | Tu plan para un producto, guardado como `docs/brief.md`, con un front matter corto que nombra el producto, sus actores, sus superficies y sus módulos. |
| **Capacidad** (*capability*) | Un área del producto (pedidos, facturas, …). Sus requisitos viven en `docs/specs/capabilities/<capability>/spec.md`. |
| **Change** | Una carpeta bajo `docs/specs/changes/<id>/` con trabajo en curso: una propuesta y un delta. Lo abre `propose` y lo cierra `archive`. |
| **Reglas D** (*D-rules*) | La lista de comprobación de redacción (D1–D12) que debe pasar un borrador hecho a partir de un brief: un escenario por requisito y por superficie, valores con origen, preguntas abiertas que bloquean, y más. |
| **Definition of Ready** | Las comprobaciones que debe pasar un ticket de Jira antes de convertirse en un change: las reglas T. |
| **Entregado** | Un estado `Implemented`, `Verified` o `Released`. |
| **Delta** | La parte de un change que dice qué se mueve: los requisitos y escenarios que añade, modifica o elimina. |
| **Borrador** | Un change abierto a partir de un brief o un ticket, y comprobado contra ese texto de origen antes de que lo revise una persona. No confundir con el estado `Draft`, que tiene un requisito antes de que empiece el trabajo sobre él y que no le debe nada al gate. |
| **Gate** | `specgate check`: los checks de la especificación (`validate --strict`), tu check de arquitectura si configuraste uno, y tus tests. `apply` lo ejecuta para un requisito; CI lo ejecuta en cada pull request. |
| **Harness** | `specgate harness run`: entrega cada requisito pendiente a un agente de código en su propio git worktree, ejecuta el gate y marca el requisito como `Implemented` solo cuando pasa. |
| **Pack** | Un modelo de dominio versionado, instalado con `specgate specops add`. |
| **Pregunta** / **Needs Clarification** | Lo que el origen de un borrador no puede responder, listado en el `questions.md` del change. Un requisito que una pregunta bloquea tiene el estado `Needs Clarification`: `apply` y el harness lo rechazan hasta que alguien responda. |
| **Requisito** (`REQ-NNN`) | Una obligación del sistema, una sección numerada en `spec.md` o en el spec de una capacidad. |
| **Escenario** (`SCN-NNN`) | Un ejemplo Gherkin que demuestra un requisito, en `features/`. |
| **Reglas T** (*T-rules*) | La Definition of Ready del ticket (T1–T9): criterios de aceptación presentes, medibles y sobre comportamiento, un ticket lo bastante pequeño, ninguna pregunta abierta, y más. |
| **Ticket** | Una historia o un bug de Jira usado como texto de origen de un change: `specgate propose --from-ticket <KEY>`. |
| **Matriz de trazabilidad** | `docs/specs/traceability.md`: una fila por escenario, que enlaza requisito, escenario, archivo feature, test, código y estado. Generada, nunca editada. |

## Siguiente

- [El método](methodology.md) — las fases, roles y artefactos que suman estas ideas
- [Primeros pasos](getting-started.md) — los cuatro verbos sobre tu repositorio
- [El primer pull request de tu equipo](first-pr.md) — autor, revisor y cada fallo
- [Escribir specs](writing-specs.md) — requisitos y escenarios que vale la pena probar
- [Validar](validating.md) — cada check que ejecuta el gate, flag por flag
