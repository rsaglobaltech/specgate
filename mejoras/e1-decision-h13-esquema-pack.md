<!-- specgate:allow-placeholders -->
# E1 · H13 medido: el esquema de pack y la autoridad que no ejerce

> **Creado:** 2026-08-23 · **Tarea:** `E1` de
> `mejoras/propuesta-harness-planificacion.md`, primera de la tanda 3.
> **Encargo:** decidir sobre `H13` **antes** de que `B1` añada `depends_on` al
> formato. No es trabajo extra: es orden de ejecución.
> **Estado:** medido, decidido el 2026-08-23 → **opción B**. §4 arreglado aparte.

---

## 0. Resumen

| Pregunta | Respuesta medida |
|---|---|
| ¿`H13` sigue vivo? | **Sí, y es mayor de lo que dice su ficha** |
| ¿Cuántos packs fallan el esquema? | **10 de 11** |
| ¿Cuántos pasan `pack lint --strict`? | **11 de 11** |
| ¿Valida algo el esquema hoy? | Un solo pack de fixture, en `tests/unit/pack-schema.test.ts`. **Ningún pack enviado** |
| ¿Basta con relajar un campo? | **No.** Son tres vocabularios distintos, no un descuido |
| Hallazgo colateral | **Una comprobación del instalador es inerte en los 11 packs** (§4) |

---

## 1. Lo que ADR-0020 declara, y lo que ocurre

ADR-0020 dice, literalmente: *«`schemas/pack.schema.json` es la única
autoridad. El validador, el instalador, `pack init` y todos los packs
enviados se ajustan a él.»*

Medido hoy, validando `packs/**/pack.yaml` con `ajv` contra ese esquema:

```
  FAIL audit-log/backend        FAIL notifications/backend
  FAIL auth/backend             FAIL reporting/backend
  FAIL billing/backend          ok   sample-contracts/contracts
  FAIL feature-flags/backend    FAIL search/backend
  FAIL file-storage/backend     FAIL webhooks/backend
  FAIL multi-tenant/backend

  RESULTADO: 1 pasan / 10 fallan
```

Y a la vez, los **once** pasan `csda pack lint --strict`, que ejecuta la
validación del instalador. O sea: la herramienta dice que los packs están bien
—y lo están, *se instalan*— mientras el documento que dice gobernarlos los
rechaza.

**Por qué no se notó.** `tests/unit/pack-schema.test.ts` existe y valida contra
el esquema… **un pack de fixture**. Los que se envían no los mira nadie. Es la
misma forma de `H14`: una comprobación que existe, parece cubrir algo, y mira a
otro sitio.

---

## 2. No es un campo: son tres vocabularios

La ficha de `H13` sugiere un desajuste. Relajando iterativamente el esquema
hasta que los packs pasen, lo que aparece es esto:

**Campos que el esquema exige y ningún pack declara:**

| Colección | Campos | Apariciones |
|---|---|---|
| `use_cases` | `aggregate`, `emits`, `scenarios`, `status` | 44 |
| `commands` | `fields` | 44 |
| `aggregates` | `context`, `invariants` | 20 |
| `events` | `type`, `producer`, `consumers` | 39 |

**Y desajustes estructurales, no de campos ausentes:**

- `aggregates` y `events` declaran `additionalProperties: false`, y los packs
  llevan claves que el esquema no conoce: `bounded_context`, `responsibilities`,
  `commands`, `events`, `aggregate`.
- `events[].payload` exige `array de string`; los packs escriben
  `payload: [invoiceId: string, amount: money]`, que `parseYamlLite` entrega
  como objetos.

Tras quitar los diez campos requeridos siguen quedando **196 errores**. No es un
descuido de migración: son dos modelos distintos del mismo dominio, y el
esquema describe uno que nadie escribe.

---

## 3. El esquema pide justo lo que ADR-0020 condenó

Merece la pena leer ADR-0020 contra sí mismo. Sobre `scenarios` dice:

> *«La exigencia anterior de 14 campos obligaba a cada pack a expresar CQRS
> completo. Un pack de front-end tenía que inventarse un comando que no tiene,
> que es la clase de regla que enseña a la gente a escribir ficción para
> satisfacer un validador.»*

Ese arreglo se aplicó a `scenarios[]` y **no** a `use_cases[]`, `commands[]`,
`aggregates[]` ni `events[]`. Exigir `aggregate`, `emits` y `scenarios` en cada
caso de uso, o `fields` en cada comando, es exactamente la misma imposición: DDD
y CQRS completos como precio de entrada.

Y enlaza con una decisión que ya está tomada en este repositorio —hacer DDD,
hexagonal y CQRS **opcionales** respetando los principios de fondo—. El esquema
es hoy el sitio donde esa obligación sigue escrita.

---

## 4. Hallazgo colateral: una comprobación que no comprueba nada

Buscando el desajuste apareció esto, y es independiente de la decisión:

```js
// PackSpec.ts — la comprobación cruzada de agregado a contexto
assertRef("bounded_contexts", aggregate.context, `Aggregate '${aggregate.id}'`);
```

```yaml
# lo que declaran los once packs
aggregates:
  - id: AGG-001
    bounded_context: BC-001    # ← no `context:`
```

`assertRef` sale sin hacer nada cuando la referencia es vacía. El instalador
lee `aggregate.context`, los packs escriben `bounded_context`, y por tanto
**esa comprobación era inerte en los once packs**.

> **Corrección (medida después de escribir esto).** La primera versión de esta
> sección decía que «un agregado que apunte a un contexto inexistente pasa el
> lint hoy». **Es falso:** `pack lint` tiene su propia comprobación, que sí lee
> `bounded_context` y lo caza. Comprobado con un pack alterado a `BC-999`:
>
> ```
> pack lint            ❌ Aggregate AGG-001 references unknown bounded_context: BC-999
> validatePackModel    pasa — no ve BC-999
> ```
>
> El hueco real es más estrecho y algo peor de explicar: **dos validadores
> discrepan**, y el silencioso es el del instalador. Por eso nadie lo notó — el
> ruidoso cubría el caso, así que el muerto nunca se echó de menos.

El esquema dice `context`, los packs dicen `bounded_context`, el instalador leía
`context`. Tres sitios, dos nombres.

**Arreglado (2026-08-23)**, en su propio commit y antes de la opción elegida:
`validatePackModel` lee `bounded_context ?? context` —las dos grafías, porque un
pack escrito contra el esquema publicado tampoco debe perder la comprobación— y
hay guarda para ambas.

---

## 5. Las opciones

### Opción A — Aplicar el esquema tal como está y migrar los packs

Añadir a los once packs los diez campos que faltan y reescribir `aggregates`,
`events` y `payload` a la forma que el esquema declara.

- **A favor:** ADR-0020 queda cierto sin tocarlo.
- **En contra:** obliga a los packs a declarar CQRS/DDD completo — justo lo que
  ADR-0020 §3 rechaza por escrito. `payload: [invoiceId: string]` tendría que
  volverse prosa plana y se pierde información. Y `pack init` tendría que
  generar todo eso, o el andamio dejaría de instalar (que es `H14` de nuevo:
  arreglar el dato y no la fuente).
- **Coste:** alto, y casi todo es ficción escrita para un validador.

### Opción B — Que el esquema describa el formato que existe, y luego se aplique de verdad **(recomendada)**

Mover el esquema a lo que el instalador realmente necesita: requerido lo que
hace falta para renderizar e instalar; el resto, **opcional pero validado
cuando está** — el mismo trato que ADR-0020 ya dio a `scenarios[]`. Corregir
`aggregates`/`events` al vocabulario real y `payload` a su forma real. Después,
**validar los once packs enviados contra el esquema en CI**, que es lo que hoy
no ocurre.

- **A favor:** ADR-0020 pasa a ser cierto en vez de aspiracional, sin obligar a
  nadie a inventar. Es coherente con la línea de DDD opcional ya decidida. Y
  cierra `H13` de verdad: a partir de ahí, un campo nuevo (`depends_on` de `B1`)
  entra en un esquema que sí gobierna.
- **En contra:** es un cambio de esquema, aunque **no rompe ningún pack** —
  relaja y corrige, no endurece. `schema_version` menor.
- **Coste:** medio-bajo. El trabajo real es el vocabulario de `aggregates` y
  `events`, no los campos requeridos.

### Opción C — Rebajar ADR-0020

Declarar el esquema documentación y no autoridad, y dejar al instalador como
único juez.

- **A favor:** barato, y describe lo que ya pasa.
- **En contra:** deja el `$schema` que `pack init` escribe en cada `pack.yaml`
  apuntando a un fichero que el editor usará para marcar en rojo packs
  perfectamente válidos. Un esquema publicado que miente es peor que no
  publicarlo.

---

## 6. Lo que recomiendo

**Opción B**, y por una razón que no es de gusto: `B1` va a añadir `depends_on`
al formato. Añadir campos a un formato cuyo esquema afirma una autoridad que no
ejerce **agranda la mentira** — cada campo nuevo es uno más que el esquema dice
gobernar y no gobierna.

Y con `B` hecho, la comprobación que falta es de una línea: validar
`packs/**/pack.yaml` contra el esquema en la suite, igual que
`shipped-gherkin.test.ts` hace con el Gherkin. Esa es la parte que impide que
`H13` vuelva.

**Independiente de la decisión:** §4 se arregla igual. Un cruce que no cruza
nada es un defecto, no una preferencia.

---

## 7. Lo que se rechaza

- **Añadir `depends_on` antes de decidir esto.** Es el orden que `E1` existe
  para imponer.
- **Migrar los packs a CQRS completo (A) «porque el esquema lo dice».** El
  esquema es un artefacto nuestro; si obliga a escribir ficción, el defecto está
  en el esquema.
- **Validar los packs en CI sin arreglar antes el esquema.** Rompería el build
  con diez fallos que no son defectos de los packs.
