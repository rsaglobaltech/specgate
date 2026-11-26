<!-- translation-of: bdbb629d3659 -->
# Escribir specs

Al final de esta página puedes añadir un requisito con su escenario, enlazarlo a
un test, entregarlo y eliminarlo, sin editar nunca a mano la matriz de trazabilidad.

**Necesitas:** un proyecto donde se haya ejecutado `specgate init`. Salen tres
términos todo el rato: un **requisito** (`REQ-007`) es una frase que el producto
debe cumplir; un **escenario** (`SCN-007`) es un ejemplo Gherkin que lo vuelve
ejecutable; la **matriz de trazabilidad** (`docs/specs/traceability.md`) es la
tabla que enlaza cada requisito con su escenario, su código y su test. Mira
[el vocabulario](concepts.md#vocabulario) para más.

<!-- specgate:diagram requirement-anatomy -->

## Añade un requisito y su escenario

**Objetivo:** un requisito nuevo con un escenario ejecutable, enlazado a un test, con `check` en verde, sin tocar la matriz.

### Mediante un change

Un requisito normalmente llega en un **change**: una carpeta que guarda los
requisitos que se añaden o modifican hasta que se construyen.

```bash
specgate propose add-premium-discount
```

Esto abre `docs/specs/changes/add-premium-discount/` con una propuesta, un delta
(los requisitos y escenarios que el change añade o modifica) y un rango
reservado de ids REQ. Escribe el requisito y su escenario en el delta, después
un test que nombre el requisito, y después el código. `specgate apply` lo
entrega y `specgate archive` integra el change en los specs.
[Cambia un requisito ya entregado](reviewing-changes.md) recorre cada paso y el formato del delta.

### El atajo: `specgate new`

En un proyecto pequeño puedes añadir un requisito directamente a `spec.md`, sin change:

```bash
specgate new "Premium customers get 10% off at checkout"
```

Escribe una sección `## REQ-NNN` en `spec.md` y un escenario etiquetado bajo
`features/`. Reescribe la frase y rellena los tres `<placeholders>`.

A mano, son las mismas dos ediciones. La sección en `spec.md`:

```markdown
## REQ-007 — Premium customers get 10% off at checkout

A premium customer's order MUST be discounted 10% before tax at checkout.
```

Y el escenario en `features/billing/discounts.feature`, etiquetado con los dos ids:

```gherkin
Feature: Apply discount on checkout

  @REQ-007 @SCN-007
  Scenario: Premium customer receives 10% discount
    Given a logged-in premium customer
    When they checkout with an order of 100 EUR
    Then the final price is 90 EUR
```

### Enlázalo a un test y ejecuta el gate

Escribe un test que mencione el requisito: esa mención es el enlace. Después
ejecuta el gate:

```bash
specgate check     # regenerates the matrix from spec.md, the tags and the tests
```

**No** añadas una fila a `docs/specs/traceability.md`: es generada, y el
siguiente `check` la sustituye por lo que dicen las fuentes. Un archivo feature
sin etiqueta `@REQ-NNN` se reporta como huérfano; etiqueta su escenario, o crea el requisito con `specgate new`.

### Escribir en español

Los escenarios pueden usar `DADO / CUANDO / ENTONCES / Y`; los archivos feature
se escriben entonces en Gherkin en español (`# language: es`, `Característica`,
`Escenario`). Para empezar a partir del brief de un cliente en lugar de una
página en blanco, mira [A partir del brief de un cliente](from-a-brief.md).

## Etiquetar un escenario

Una fila de la matriz nombra un id de escenario. Las etiquetas son la forma en
que el archivo feature lo nombra de vuelta, y sobreviven a que alguien reescriba
el título del escenario:

```gherkin
@REQ-014 @SCN-014
Scenario: A vet with no speciality is listed under "general practice"
  Given a vet with no speciality
  When the directory is listed
  Then the vet appears under "general practice"
```

**Las dos etiquetas, y `@SCN-NNN` es la que compara el gate.** `@REQ-NNN` dice a
qué requisito pertenece el escenario, y es lo que selecciona un filtro de
Cucumber `--tags "@REQ-014"`; `@SCN-NNN` es lo que `validate` compara con el id
de escenario de la fila.

**Un fichero sin ninguna etiqueta se deja en paz.** Etiquetar es opcional, y
etiquetar un escenario no lo impone al resto del proyecto. Pero en cuanto un
archivo feature lleva alguna de estas etiquetas, cada fila que apunta a ese
fichero debe encontrar ahí su `@SCN-NNN`.

En una matriz **mantenida a mano**, una fila que declara `SCN-014` y un fichero
etiquetado solo con `@REQ-014` falla, por tanto, y lo dice:

```
✖ features/vets/listing.feature carries traceability tags but not @SCN-014,
  which REQ-014 declares. The matrix points at a scenario that is not there.
```

En una matriz **generada** la fila se construye a partir de las etiquetas, así
que un escenario etiquetado solo con `@REQ-014` sigue enlazado, sin id de
escenario en su fila. Añade `@SCN-NNN` de todos modos: quien revisa, un filtro
de Cucumber y un título renombrado dependen de ella.

## Cierra el ciclo: `status` → implementar → `apply`

**Objetivo:** cuando hay requisitos nuevos en el proyecto (de un change, o de un
pack de dominio que instalaste), recórrelos de uno en uno, a mano o con un
agente, sin leer cada archivo `.feature`.

```bash
specgate status          # one line per requirement, and the next command
specgate plan            # every artifact spelled out; an open change's requirements only once archived
```

`plan` agrupa los requisitos según lo que aún le falta a cada uno:

```
  Needs Test + Code
    REQ-001   SCN-001
      ✓ feature: `features/audit-log/recording_an_action_emits_auditentryrecorded.feature`
    REQ-002   SCN-002
      ✓ feature: `features/audit-log/tampering_breaks_the_chain_verification.feature`

  Needs Feature File
    REQ-003   -
      · feature: -
```

Para un agente, pide JSON:

```bash
specgate plan --json
```

```json
{
  "schemaVersion": 1,
  "summary": { "NEEDS_EVERYTHING": 2, "NEEDS_FEATURE": 2 },
  "total": 4,
  "actionable": 4,
  "next": "REQ-001",
  "requirements": [
    {
      "requirement": "REQ-001",
      "scenarioId": "SCN-001",
      "category": "NEEDS_EVERYTHING",
      "status": "Draft",
      "ready": true,
      "blockers": []
    }
  ],
  "orphanFeatures": [],
  "status": []
}
```

`next` es el requisito en el que trabajar, y `actionable` cuántos se pueden
empezar ya. Cada requisito lleva su `category`, si está `ready`, y los
`blockers` que tiene delante, cada uno con un `code` y un `fix`.

### Después de implementar, aplícalo

```bash
specgate apply REQ-007                          # the gate, then Status="Implemented"
specgate apply REQ-007 --status Verified         # Status="Verified", same gate
specgate apply REQ-007 --test-cmd "npm test"     # the gate, then the test suite
specgate apply REQ-007 --no-check                # the status, without the gate
```

`apply` rechaza un requisito que ningún test nombra, ejecuta el mismo gate que
`specgate check`, y no escribe nada cuando falla. Los estados son Draft,
Approved, Implemented, Verified, Released y Deprecated; cualquier otra palabra se
rechaza. Todos los posteriores a Draft salvo Deprecated deben un test (TDD-1),
Approved incluido: `--status Approved` rechaza un requisito que ningún test
nombra, porque `validate --strict` fallaría con él. Un requisito que cierra es
uno que CI no reabrirá. Cambia exactamente un estado, y no commitea:
commitea después. Con `validate --strict` en CI, la matriz sigue siendo un
registro fiel de lo entregado.

`apply` también rechaza un requisito de un change que ninguna persona aprobó
(`change_not_approved`); mira
[Una persona aprueba el borrador](reviewing-changes.md#una-persona-aprueba-el-borrador).
Y cuando empieza el código, el guard del agente registra los ficheros de step
definitions. Si cambian después, rechazan la entrega (`steps_changed_after_code`):
puede que los pasos se hayan doblado para encajar con el código. Una persona que
leyó los pasos nuevos lo dice en una terminal:

```bash
specgate apply REQ-007 --steps-reviewed
```

Desde la herramienta de un agente se rechaza (`steps_review_needs_person`).

### Con un agente

Un agente sigue el mismo ciclo: `status` o `plan` para el siguiente requisito,
un test que falla y lo nombra, el código, y después `apply`. Para dirigirlo sin
supervisión, usa [el harness](harness.md). Para dar a un cliente MCP (Claude
Desktop, Cursor) el ciclo como herramientas, mira [El servidor MCP](mcp.md). Ahí,
las herramientas que escriben la especificación se niegan si no hay un change abierto.

## Eliminar un requisito

```bash
specgate req rm REQ-014 --dry-run   # what would go
specgate req rm REQ-014
```

Elimina las filas del requisito en la matriz y su prosa en `spec.md`. Más allá
de Draft se niega sin `--force`: eliminar un requisito entregado borra el
registro de que se entregó, y `specgate apply REQ-014 --status Deprecated` suele
ser lo que querías.

Reporta lo que deja atrás, como un archivo feature al que ya no hace referencia ninguna fila, que si no haría fallar `validate` más adelante.

### No existe `req renumber`

Un id de requisito aparece en más sitios que la matriz: en las etiquetas
`@REQ-014`, en nombres de tests, en mensajes de commit, en una rama
`harness/REQ-014` a la que alguien ya hizo push, y en tu gestor de incidencias.
Renumerar solo los ficheros que controla Specgate dejaría cualquier otra
mención apuntando al id antiguo.

Si necesitas otro id, haz `req rm` del antiguo y `req add` del nuevo, para que el cambio se vea en el diff.

## Una matriz que nadie edita

`docs/specs/traceability.md` es **generada**, por defecto, en cada proyecto que
crean `init` o `adopt` (`--keep-matrix` lo desactiva). Cada columna ya está
dicha en otro sitio, así que `specgate matrix` la calcula:

| Columna                   | Viene de                                                                     |
| ------------------------- | ---------------------------------------------------------------------------- |
| Requirement, Use Case     | la sección `## REQ-NNN — title` en `spec.md`                                 |
| Scenario ID, Feature file | los escenarios etiquetados `@REQ-NNN @SCN-NNN` (los escribe `specgate new`)  |
| Test artifact             | los ficheros de test que mencionan `REQ-NNN`: basta un comentario o el nombre de un test |
| Technical artifact        | otros ficheros fuente que mencionan `REQ-NNN`                                |
| Status                    | `status=` en el comentario `<!-- specgate:trace … -->` de la sección         |

Lo que las fuentes no pueden mostrar (la ruta de un código, un test que no
nombra su requisito, las columnas DDD) va en ese mismo comentario:

```markdown
## REQ-003 — Orders can be cancelled

<!-- specgate:trace status=Implemented artifact=lib/orders.js -->
```

**Pasar un proyecto antiguo con una matriz mantenida a mano:**

```bash
specgate matrix --migrate   # writes status and explicit links into spec.md
```

Escribe solo lo que el generador haría mal de otro modo, después genera la
matriz y la compara con la tuya fila a fila. Si algo difiere, **no se cambia
nada**: nombra los requisitos que aún no puede expresar (normalmente varias
filas para un requisito cuyos escenarios no están etiquetados) y cómo
corregirlos.

**A partir de ahí**, la matriz lleva un marcador `specgate:derived` y nunca se
edita a mano. `specgate check` la regenera antes del gate; un `validate` simple,
que ejecuta CI, falla con `matrix_stale` si un commit olvidó hacerlo, y
`specgate matrix` lo arregla.

Los comandos de cada día escriben las fuentes por ti: `specgate apply` pone
`status=` en el comentario del requisito, `req link` y `req add --feature …`
registran ahí sus enlaces, `new`, `req rm` y `archive` regeneran la matriz,
y `status`, `plan` y `check` la leen al momento. **Un límite:** un pack de
dominio escribe `spec.md` y la matriz a partir de sus propias plantillas, así
que `specgate expand` devuelve el proyecto a una matriz mantenida a mano y lo
dice; ejecuta `specgate matrix --migrate` cuando los requisitos del pack tengan
secciones `## REQ-NNN`.

## Siguiente

- [Glosario, reglas numeradas y diagramas](domain-language.md)
- [Cambia un requisito ya entregado](reviewing-changes.md)
- [Validar](validating.md)
