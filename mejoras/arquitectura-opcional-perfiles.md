<!-- specgate:allow-placeholders -->
# DDD, hexagonal y CQRS: de obligatorios a opcionales, sin aflojar la puerta

> **Creado:** 2026-08-21
> **Pregunta del usuario:** el proyecto obliga siempre a DDD, hexagonal y CQRS,
> que no siempre hacen falta. ¿Se pueden hacer opcionales, respetando siempre
> principios bien fundamentados y pilares del mercado — eso no es negociable?
> **Respuesta corta:** sí, y **la mitad ya está hecha** — en los packs. Falta en
> `init` y en `AI_RULES.md`. La puerta (`validate`) **ya es agnóstica al patrón**
> y no hay que tocarla.

---

## 0. Veredicto

| | |
|---|---|
| ¿Obliga la **puerta** a DDD/CQRS? | **No.** Medido: borrando los cinco documentos DDD de un proyecto generado, `csda validate` **pasa** |
| ¿Quién obliga entonces? | El **andamiaje** de `init` (crea cinco documentos DDD a todo proyecto) y el **rulebook del agente** (`AI_RULES.md`), que es prosa que el agente obedece |
| ¿Hay precedente interno? | **Sí, y decisivo.** El esquema de packs ya declara `use_cases`, `commands`, `aggregates`, `events` como **opcionales**, y `ExpandDomainPackCommand` ya elige matriz rica o simple con `hasStructuredDomainModel(pack)` |
| ¿Qué es lo no negociable? | Lo que la puerta ya exige: identidad, trazabilidad, escenario ejecutable, test antes de «In Dev». **Ninguno depende de DDD** |

**La frase que lo resume:** csda no impone DDD; impone **rastreabilidad**. Lo
que pasa es que su andamiaje por defecto y su rulebook hablan solo un dialecto
—el táctico de DDD— y no ofrecen otro. El arreglo no es relajar la puerta, es
**dar dialectos**.

---

## 1. Qué se obliga hoy, de verdad

Hay tres niveles y conviene no confundirlos, porque el que se percibe como
«obligatorio» no es el que puede fallar una build.

### Nivel 1 — La puerta (`csda validate`). **Máquina. No negocia.**

Exige exactamente esto:

```
spec.md · AI_RULES.md · README.md · docs/specs/traceability.md · docs/specs/adr/README.md
features/ · docs/specs/          al menos un .feature
matriz con cabecera reconocible  ·  toda feature con fila  ·  estados legales
--strict-tdd: test declarado antes de pasar de Draft, id de escenario, REQ del spec en la matriz
```

**Ni un solo documento de DDD.** `use-cases.md` y `events.md` se comprueban
**solo si existen** — y lo que se comprueba es su cabecera, no su contenido.
Medido:

| Proyecto generado | `validate` |
|---|---|
| tal cual | **PASS** |
| tras borrar `aggregates.md`, `events.md`, `commands.md`, `domain-model.md`, `use-cases.md` | **PASS** |

### Nivel 2 — El andamiaje (`csda init`). **Por defecto, y sin alternativa.**

Un sitio web de marketing estático (`PROJECT_TYPE=frontend`, `DATASTORE=none`)
recibe hoy:

```
docs/specs/domain-model.md    30 líneas
docs/specs/commands.md        13 líneas
docs/specs/status-model.md    16 líneas
docs/specs/aggregates.md       5 líneas
docs/specs/events.md           5 líneas
docs/specs/use-cases.md        5 líneas
```

Un sitio estático no tiene agregados ni emite eventos de dominio. Son 74 líneas
de vocabulario que ese proyecto no va a usar — y, peor, que un agente leerá como
si describieran el sistema.

### Nivel 3 — El rulebook del agente (`AI_RULES.md`). **Aquí están los dientes.**

`templates/backend/AI_RULES.md.tpl`:

```
## Pre-Implementation Gates
- [ ] Scenario maps to a use case.
- [ ] Use case maps to command or query.
- [ ] Command/query maps to aggregate or read model.
- [ ] Domain events are listed when state changes matter.
```

Y `templates/frontend/AI_RULES.md.tpl` pide lo mismo, apenas suavizado:
*«Command/query maps to aggregate, read model, or UI state model»*.

Esto no lo comprueba ninguna máquina, pero es lo que **el agente lee y obedece
en cada prompt**. Es, en la práctica, la obligación más fuerte de las tres — y
la menos visible, porque no aparece como un fallo, aparece como código con
`CreateInvoiceCommandHandler` en un formulario de contacto.

---

## 2. El precedente que ya existe en casa

Esta pregunta **ya está resuelta** en la mitad del producto.

`schemas/pack.schema.json` — obligatorio: `schema_version`, `metadata`,
`variables`, `requirements`, `outputs`, `rules`. **Opcional:**

```
bounded_contexts · use_cases · commands · aggregates · value_objects
events · business_rules · scenarios · api_contracts · …
```

Y `ExpandDomainPackCommand` ya hace exactamente lo que este documento propone:

```ts
let mode = hasStructuredDomainModel(pack) ? "rich" : "legacy";
```

**Un pack sin modelo de dominio recibe la matriz de 4 columnas; uno con modelo
recibe la de 10.** El concepto de perfil existe, está probado y está en
producción — solo que `init` no lo tiene.

Además, el propio formato ya tolera el «no aplica»: la fila que `init` genera
hoy para un frontend trae `-` en Aggregate y en Event. La matriz **no miente**
cuando no hay agregado; simplemente nadie le ha dicho al andamiaje que puede no
haberlo.

Y el mecanismo de andamiaje condicional también está probado, con validación de
combinaciones imposibles: `DOCKER_SUPPORT=false` no deja artefactos Docker
huérfanos, y `DEVCONTAINER_SUPPORT=true` sin Docker se rechaza con un mensaje.
**No hay que inventar maquinaria: hay que usar la que ya funciona.**

---

## 3. Lo no negociable

La distinción que ordena todo: **un principio dice qué propiedad debe cumplirse;
un patrón dice cómo se consigue.** csda debe exigir principios y ofrecer
patrones.

### 3.1 Los pilares que se quedan, pase lo que pase

| Principio | Por qué no se negocia | Quién lo hace cumplir hoy |
|---|---|---|
| **Todo requisito tiene identidad estable** | Sin `REQ-NNN` no hay trazabilidad, ni ALM, ni grafo, ni harness | `validate` |
| **Todo requisito tiene criterio de aceptación ejecutable** | Un requisito sin escenario Gherkin es una opinión. Es la tesis del producto | `validate` (`no_feature_files`, `feature_not_in_matrix`) |
| **Trazabilidad completa y bidireccional** | Es el producto | `validate` + la matriz |
| **El test existe antes de declarar el trabajo empezado** | `--strict-tdd`. Es la única señal de recompensa determinista que tiene el harness | `validate --strict-tdd` |
| **La spec es la fuente de verdad; el tablero es espejo** | [ADR-0021](../docs/specs/adr/0021-alm-is-a-mirror.md) | Dos guardas ejecutables |
| **Las decisiones se registran (ADR)** | Sin ADR, cada refactor rediscute lo mismo | `validate` exige `adr/README.md` |
| **La lógica de negocio no vive en el framework** | Esto **sí** es universal, y no es DDD: es separación de intereses. Un `if` de negocio dentro de un controlador de Express es igual de malo con o sin agregados | Hoy solo `AI_RULES` |

Las primeras seis ya las exige la máquina. La séptima es la única que hoy solo
existe como prosa, y es precisamente **la que hay que conservar cuando se quiten
los agregados** — porque es el valor real que la gente cree que le da DDD.

### 3.2 Lo que pasa a ser opcional

| Patrón | Cuándo vale la pena | Cuándo estorba |
|---|---|---|
| **Agregados / raíces de agregado** | Invariantes que cruzan varias entidades | CRUD sobre una tabla |
| **CQRS (comando/consulta separados)** | Lecturas y escrituras con cargas o modelos distintos | Un CRUD donde comando y consulta tocan lo mismo |
| **Eventos de dominio** | Varios consumidores, integración asíncrona | Un monolito donde nadie escucha |
| **Puertos y adaptadores (hexagonal)** | Varias entradas/salidas intercambiables | Un script, un job, una landing |
| **Contextos delimitados** | Varios equipos, varios lenguajes de dominio | Un equipo, un dominio |

Esto coincide con lo que dice el sector: DDD es **excesivo para CRUD simple,
prototipos y proyectos cortos**, y valioso en **lógica compleja, aplicaciones
longevas y varios equipos**. El riesgo de aplicarlo por defecto es
*complejidad accidental*, que es exactamente lo que produce hoy un
`aggregates.md` en un sitio estático.

---

## 4. La propuesta: perfiles de arquitectura

Una clave nueva en la configuración del proyecto, con el mismo mecanismo que ya
gobierna Docker y el datastore.

```yaml
# project.config
ARCHITECTURE: "tactical-ddd"   # o "layered", o "minimal"
```

| Perfil | Para qué | Documentos que genera | Matriz |
|---|---|---|---|
| **`minimal`** | Scripts, landings, prototipos, CLIs | ninguno de dominio | 4 columnas (legacy) |
| **`layered`** *(por defecto propuesto)* | La mayoría: APIs CRUD, frontends, servicios | `use-cases.md` | 10 columnas, con `-` en Aggregate y Event |
| **`tactical-ddd`** | Dominios complejos, varios equipos | los seis actuales | 10 columnas completas |

**Reglas de la propuesta:**

1. **La puerta no cambia.** `validate` sigue exigiendo lo mismo para los tres
   perfiles. Un proyecto `minimal` con un requisito sin escenario falla igual.
2. **`AI_RULES.md` se genera por perfil.** Los *Pre-Implementation Gates* de
   `tactical-ddd` no aparecen en `minimal`; lo que sí aparece en los tres es
   *«la lógica de negocio no vive en el framework»* y *«no hay implementación sin
   fila de trazabilidad»*.
3. **Se puede subir de perfil, no bajar en silencio.** Pasar de `minimal` a
   `tactical-ddd` es andamiaje nuevo. Bajar borraría documentos con contenido, así
   que se avisa y no se hace solo.
4. **El perfil se declara, no se adivina.** Inferirlo del tipo de proyecto sería
   volver a decidir por el usuario, que es el problema de partida.
5. **`doctor` avisa de la incoherencia**, que es donde estará el valor real:
   un proyecto `minimal` con doce agregados en el modelo, o uno `tactical-ddd`
   con `aggregates.md` vacío desde hace seis meses. El perfil declarado y la
   realidad se separan, y eso se puede ver.

### 4.1 Por qué el defecto propuesto es `layered` y no `tactical-ddd`

Porque el defecto es una recomendación, y recomendar el patrón más caro a todo
el mundo es lo que produjo esta conversación. `layered` conserva lo que casi
todos los proyectos aprovechan de verdad —casos de uso nombrados y trazables,
lógica fuera del framework— y deja fuera lo que casi nadie usa bien sin haberlo
pedido.

Cambiar el defecto es, eso sí, **una rotura de comportamiento**: proyectos
nuevos dejarían de recibir seis documentos que hoy reciben. Va con un major, o
detrás de una bandera durante una versión.

---

## 5. Lo que **no** hay que hacer

- **Relajar `validate`.** La tentación al hablar de «opcional» es aflojar la
  puerta. Es al revés: la puerta es lo único que sostiene el producto, y ya es
  agnóstica al patrón. Tocarla sería resolver un problema de andamiaje rompiendo
  lo que funciona.
- **Quitar las columnas Aggregate/Event de la matriz rica.** Ya aceptan `-`, y
  quitarlas rompería `done` y `alm/core`, que leen Status como penúltima celda
  — el mismo hecho que en `E1-01` descartó añadir una columna.
- **Inferir el perfil del `DOMAIN` o del `STACK`.** «banca ⇒ DDD» es una
  superstición cara.
- **Un perfil por framework.** El perfil describe la forma del problema, no la
  del framework.
- **Dejarlo como está y documentar que los ficheros son opcionales.** Ya lo son
  técnicamente, y aun así todo el mundo los rellena — porque el andamiaje los
  crea y el rulebook los exige. Un opcional que el generador crea siempre no es
  un opcional.

---

## 6. Riesgos

| # | Riesgo | Mitigación |
|---|---|---|
| A1 | **Tres perfiles son tres andamiajes que mantener**, y dos se probarán menos | Un test por perfil que genere y valide, como ya existe para Docker y datastore |
| A2 | **El perfil se elige mal y se descubre tarde** | Subir de perfil es aditivo y está soportado; `doctor` avisa de la deriva |
| A3 | **`minimal` se lee como «sin disciplina»** y se elige por pereza | El nombre y la documentación deben decir lo que conserva: la puerta es idéntica en los tres |
| A4 | **Los packs curados asumen `tactical-ddd`** | Ya lo tienen resuelto: `hasStructuredDomainModel` decide, y un pack sin dominio ya expande a matriz simple |
| A5 | **Cambiar el defecto rompe expectativas** | Major, o bandera durante una versión |

---

## 7. Preguntas abiertas

| # | Pregunta | Quién decide |
|---|---|---|
| P1 | ¿Tres perfiles o dos? `layered` y `tactical-ddd` cubren casi todo; `minimal` puede ser `layered` sin `use-cases.md` | Decisión de producto |
| P2 | ¿El defecto cambia a `layered`, o sigue `tactical-ddd` y se documenta la alternativa? Lo primero es lo correcto y es rotura | Decisión de versión |
| P3 | ¿Hexagonal es un perfil o un eje aparte? Se puede tener puertos y adaptadores sin agregados, y agregados sin hexagonal | Decisión de modelo — merece ADR |
| P4 | ¿Un pack puede **exigir** un perfil mínimo? Un pack de banca con agregados sobre un proyecto `minimal` no encaja | Decisión de modelo |
| P5 | ¿`adopt` infiere el perfil del código existente? Hay código para inferir packs (`pack infer`); esto es el mismo problema | Posible `E2-0x` |

---

## 8. Recomendación

1. **ADR primero**, porque esto es una decisión de modelo y no de código: *los
   patrones son opcionales, los principios no*, con la lista de §3.1 escrita
   como invariante.
2. **`ARCHITECTURE` en la configuración**, con los tres perfiles y el mismo
   mecanismo condicional que ya usan `DOCKER_SUPPORT` y `DATASTORE`.
3. **`AI_RULES.md` por perfil.** Es el cambio de mayor efecto real y el más
   barato: es una plantilla más, y es donde vive la obligación que hoy se siente.
4. **`doctor`: perfil declarado contra realidad.** Lo que convierte esto en una
   propiedad verificable y no en una preferencia.
5. **El defecto se cambia aparte**, con su propia decisión de versión.

Nada de esto toca `validate`. Ese es el resumen de por qué la propuesta es
segura: **lo que hace bueno a este producto ya no depende de DDD, solo su
andamiaje lo parecía.**

---

## 9. Fuentes

- [DDD, CQRS y arquitectura hexagonal — las partes buenas (ConFoo)](https://confoo.ca/en/2026/session/ddd-cqrs-and-hexagonal-architecture-the-good-parts)
- [Herberto Graça — DDD, Hexagonal, Onion, Clean, CQRS: cómo encajan](https://herbertograca.com/2017/11/16/explicit-architecture-01-ddd-hexagonal-onion-clean-cqrs-how-i-put-it-all-together/)
- [Quarkus Insights #248 — introducción a DDD y hexagonal](https://quarkus.io/blog/quarkus-insights-248-ddd-hexagonal-architecture/)
- [Aplicando DDD táctico, hexagonal y CQRS — y dónde se pasa de rosca](https://medium.com/@lesimoes/architecture-with-nest-applying-tactical-ddd-hexagonal-and-cqrs-part-i-36bccd209993)

---

## 10. Implementación *(2026-08-21)*

Hecho todo salvo el cambio de defecto, que sigue siendo decisión de versión.

| # | Tarea | Estado |
|---|---|---|
| 1 | [ADR-0022](../docs/specs/adr/0022-patterns-are-optional-principles-are-not.md) | `[x]` |
| 2 | Clave `ARCHITECTURE` con tres perfiles y validación | `[x]` |
| 3 | `AI_RULES.md` generado por perfil | `[x]` |
| 4 | `doctor`: perfil declarado contra realidad | `[x]` |
| 5 | Cambiar el defecto a `layered` | `[ ]` **— rotura, va con un major** |

**Cómo quedó:**

- `ARCHITECTURE_DOCS` declara qué documentos conserva cada perfil, y
  `applyArchitectureProfile` quita el resto — el mismo patrón que
  `applyRuntimeSupportFlags` ya usaba para Docker: se renderiza todo y se retira
  lo que la configuración no pidió, así hay **un** camino de renderizado y no
  tres.
- `architectureSections()` genera los bloques de `AI_RULES.md`. Es donde vivía
  la obligación real, y por eso era la tarea de mayor efecto por lo que cuesta.
- El perfil queda escrito en `AI_RULES.md` (`- Architecture: layered`), junto a
  Stack y Domain. No había ningún fichero de configuración persistido en el
  proyecto generado, y crear uno solo para esto habría sido inventar estado.

**Verificado, no supuesto:** los tres perfiles generan lo que declaran, y
**`validate` pasa idéntico en los tres** — el invariante del ADR tiene su propio
test. Comprobado también desde el tarball empaquetado.

**Lo que se decidió sobre la marcha, y por qué:**

`doctor` mira **la matriz, no los documentos de dominio**. La primera versión
miraba si `aggregates.md` tenía filas — y decía «coincide» en un proyecto recién
generado, porque las plantillas traen filas de ejemplo (`AGG-001 | CoreAggregate`,
`CMD-001 | ExampleCommand`). O sea: «el fichero tiene contenido» es cierto desde
el primer minuto y no dice nada. Las columnas Aggregate y Event de la matriz
llevan `-` hasta que alguien las usa, que es exactamente la pregunta. Y el aviso
de `tactical-ddd` sin dominio solo sale con más de un requisito: un proyecto
recién creado no ha modelado nada todavía, y eso no es deriva.

**Los dos guardas están mutados:** si `minimal` deja de quitar los documentos,
falla; si `minimal` recibe los gates de DDD, falla.

**Pendiente consciente:** `adopt` no infiere el perfil (P5), y `templates/adopt/`
sigue con su propio `AI_RULES` sin perfil. Un proyecto adoptado no declara
arquitectura hoy.
