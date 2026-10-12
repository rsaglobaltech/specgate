<!-- specgate:allow-placeholders -->
# ¿Sustituir `traceability.md`? Qué hay en el mercado y qué encaja aquí

> **Creado:** 2026-08-21
> **Pregunta del usuario:** cómo sustituir `traceability.md` por opciones más
> escalables y mejor trazables, revisando qué existe en el mercado.
> **Relación:** continúa `mejoras/colisiones-traceability-paralelo.md`, que
> resolvió el síntoma (los choques al mergear). Esto mira la pregunta de fondo:
> si el formato es el correcto.

---

## 0. La respuesta corta

**El formato no es el cuello de botella, y el dato más importante es que la
matriz ya es casi enteramente derivable.** Las diez columnas salen del
comentario `csda:trace` que cada requisito ya lleva en su spec de capacidad —
`TraceabilityMatrix.traceRow()` las mapea una a una. Es decir: **el repositorio
ya implementa el modelo que usan las herramientas serias del mercado, pero
guarda el resultado en vez de derivarlo.**

| Pregunta | Respuesta medida |
|---|---|
| ¿Se queda corto por tamaño? | **No.** 50.000 filas se parsean en 81 ms. La matriz real más grande de esta máquina tiene **46 filas** |
| ¿Se queda corto por conflictos? | **No por tamaño** — solo chocan filas *directamente contiguas*; a 1.000 filas la probabilidad de dos ediciones al azar es ~0,2 %. Sí por **patrón de acceso**: el harness coge requisitos consecutivos, así que su probabilidad es ~1 |
| ¿Qué le falta de verdad? | Consultas tipadas, legibilidad a partir de ~100 filas, y que el estado esté en dos sitios |
| ¿Hay algo mejor en el mercado? | Sí, y el más cercano —OpenFastTrace— hace exactamente lo que csda ya tiene a medias: **no guarda matriz, la genera** |

---

## 1. Qué tiene que hacer el fichero hoy

Medido, no supuesto.

**Lo leen o lo escriben 38 ficheros.** `validate`, `plan`, `status`, `done`,
`report`, `fix`, `doctor`, `req`, `change archive`, `alm sync`, `harness run`,
`specops`, los packs y el propio driver de merge. Eso no es un detalle de
implementación: **es el coste real de cualquier cambio de formato**, y es la
razón por la que «cambiar el fichero» no es una tarea pequeña aunque el fichero
lo parezca.

**Diez columnas:** Requirement · Scenario ID · Feature file · Use Case ·
Command/Query · Aggregate · Event · Technical artifact · Test artifact · Status.

**Tamaños reales, en esta máquina:**

| Proyecto | Filas |
|---|---|
| insurance-ai-platform | 46 |
| este repositorio | 22 |
| hie-his-platform | 17 |
| csda-studio-app | 16 |

Nadie está cerca de un límite. La preocupación por escalar es **anticipada, no
observada** — lo cual no la invalida, pero sí cambia qué urge.

---

## 2. Dónde se rompe de verdad

### 2.1 No en el rendimiento

Parseo del formato actual, con el parser que hay:

| Filas | Tamaño | Parseo |
|---|---|---|
| 100 | 9 KB | 0,5 ms |
| 1.000 | 91 KB | 5,1 ms |
| 10.000 | 962 KB | 20,8 ms |
| 50.000 | 5 MB | 81,5 ms |

Lineal y barato. **El tamaño no es el problema**, y cualquier propuesta que se
justifique por rendimiento está resolviendo algo que no duele.

### 2.2 En el patrón de acceso, no en el tamaño

Cuánto tienen que distar dos ediciones para no chocar, sobre una matriz de 100
filas:

| Distancia entre las filas editadas | Merge |
|---|---|
| 1 (contiguas) | **CONFLICT** |
| 2 | limpio |
| 3, 4, 5, 10 | limpio |

Solo chocan las filas **pegadas**. Para dos ediciones al azar en N filas la
probabilidad es ≈ 2/(N−1): un 4 % a 46 filas, un 0,2 % a 1.000. **Crecer mejora
el problema, no lo empeora.**

Pero el harness no edita al azar: `plan` devuelve la cola en orden de matriz y
`--concurrency N` coge los N primeros, que son **consecutivos**. Su probabilidad
de choque es ~1 y **no baja al crecer el proyecto**. Por eso mordió, y por eso el
driver de merge era la respuesta correcta al síntoma.

### 2.3 Los límites reales

1. **Legibilidad.** Una tabla de 10 columnas y 300 filas no se revisa en un PR.
   La ventaja de «cabe en una pantalla» se pierde mucho antes de que falle nada
   técnico.
2. **No hay consultas.** «¿Qué requisitos tocan el agregado `Policy`?» obliga a
   parsear el fichero entero. No hay índice ni tipos: cada consumidor
   reimplementa su lectura, y de hecho `GeneratePlanUseCase` tiene su propio
   parser de filas distinto del de `TraceabilityFormat`.
3. **El estado vive en dos sitios.** `csda:trace` admite `status=`, pero `done`
   escribe el estado **solo en la matriz**. Duplicidad latente.
4. **Amplificación de escritura.** Marcar un requisito reescribe el fichero
   entero. Con 46 filas da igual; es lo que hace que el diff de un cambio de
   estado no sea de una línea en cuanto el formateo cambia.

---

## 3. Qué hay en el mercado

### 3.1 Docs-as-code, que es la familia de csda

| Herramienta | Modelo de almacenamiento | Trazabilidad | Nota para csda |
|---|---|---|---|
| **[OpenFastTrace](https://github.com/itsallcode/openfasttrace)** | Ítems en Markdown con cabeceras `Covers:` / `Needs:` / `Depends:`, más **etiquetas de cobertura en comentarios del código fuente** | **No guarda matriz: la genera** como informe HTML/texto | **El más cercano al modelo que csda ya declara.** Cero conflictos porque no hay fichero que mergear |
| **[Doorstop](https://github.com/doorstop-dev/doorstop)** | **Un fichero YAML por requisito**, en árbol de directorios | Enlaces padre-hijo entre ítems | Cero conflictos por construcción. Pierde la tabla legible de un vistazo |
| **[StrictDoc](https://strictdoc.readthedocs.io/)** | `.sdoc`, **un fichero por documento** con gramática propia | Enlaces bidireccionales + export HTML con grafo navegable | Más ceremonia; su fuerte es el export navegable |
| **[Sphinx-Needs](https://sphinx-needs.readthedocs.io/)** | Directivas dentro de reStructuredText/Sphinx | Objetos `need` enlazados, filtrables | Ata el proyecto a la cadena Sphinx |
| **rmtoo** | Un `*.req` por requisito, clave-valor | Grafo dirigido de dependencias | Similar a Doorstop, menos vivo |
| **[shtracer](https://github.com/qq3g7bad/shtracer)** | Markdown + etiquetas en comentarios | Matriz generada | Prueba de que el enfoque «etiqueta + generar» es viable en scripts |

### 3.2 Estándares de intercambio

- **[ReqIF](https://en.wikipedia.org/wiki/Requirements_Interchange_Format)** —
  estándar OMG, XML, para **intercambiar** requisitos entre herramientas de
  distintos fabricantes. Lo soportan DOORS, DOORS Next y Polarion. Es el formato
  que pide la automoción cuando OEM y proveedores usan plataformas distintas.
  **No es un formato de trabajo**: es un formato de exportación, verboso y
  pensado para máquinas.
- **OSLC** — enlaces vivos entre herramientas por HTTP, sin duplicar datos.
  Potente y con poco soporte real; exige infraestructura.

### 3.3 Suites comerciales

IBM DOORS / DOORS Next, Siemens Polarion, Jama Connect, Perforce Helix ALM,
Matrix Requirements. Todas resuelven trazabilidad con **base de datos + interfaz
web**, no con ficheros. Es el modelo opuesto al de csda: potente, auditable,
certificable — y con el estado fuera del repositorio, que es justo lo que este
proyecto existe para no hacer. **No son alternativas, son otro producto.**

---

## 4. El hallazgo que reordena la pregunta

`packages/core/src/domain/TraceabilityMatrix.ts` ya hace esto:

```ts
scenarioId:        trace.scn  || primerEscenario.id
featureFile:       trace.feature
useCase:           trace.uc
commandOrQuery:    trace.cmd || trace.qry
aggregate:         trace.agg
event:             trace.evt
technicalArtifact: trace.artifact
testArtifact:      trace.test    || "TBD"
status:            trace.status  || "Draft"
```

**Las diez columnas salen del comentario `csda:trace` del spec de capacidad.**
La matriz no es una fuente de verdad paralela: es una **proyección** que resulta
que se guarda. Y el propio repositorio ya lo dice en su modelo — *«el requisito
declara, la matriz refleja»*, escrito al cerrar `E1-01`.

La única grieta: **`done` escribe el estado en la matriz y no en el spec**, así
que hoy el estado es el único campo del que la matriz es dueña de verdad.

Eso convierte la pregunta «¿por qué formato sustituimos la matriz?» en otra
mucho más barata:

> **¿Y si la matriz deja de guardarse y se genera, y lo único que se almacena es
> el estado?**

Es exactamente lo que hace OpenFastTrace. Y un fichero generado **no tiene
conflictos de merge**, porque no se mergea: se regenera.

---

## 5. Opciones para csda, ordenadas por coste

| # | Opción | Qué cambia | Coste | Veredicto |
|---|---|---|---|---|
| **1** | **Quedarse como está** | Nada. El driver de merge ya quitó el dolor | Cero | **Correcto hoy** |
| **2** | **Matriz derivada + estado aparte** | `traceability.md` pasa a generado; el estado vive en un fichero pequeño por requisito o en el propio spec | Medio-alto | **La dirección correcta** |
| **3** | Un fichero por requisito (Doorstop) | Se pierde la tabla | Muy alto | No |
| **4** | Formato propio tipo `.sdoc` | Gramática nueva, parser nuevo | Muy alto | No |
| **5** | Export ReqIF **añadido**, no sustituto | Un comando `csda export --reqif` | Bajo | **Sí, cuando lo pida un cliente** |
| **6** | Base de datos | Saca el estado del repositorio | — | **Rechazado por diseño** |

### 5.1 Por qué la 1 es la respuesta hoy

Nadie tiene más de 46 filas. El parseo sobra. El choque de merge está resuelto y
medido. Cambiar el formato ahora sería pagar 38 ficheros de refactor por un
problema que aún no existe — y el plan de cierre ya dice que antes de 1.0 solo
entran refactores sin cambio de contrato.

### 5.2 Cómo sería la 2, si se hace

1. **Un solo dueño del estado.** Hoy `csda:trace` admite `status=` y `done`
   escribe en la matriz. Elegir uno. Lo coherente con «el requisito declara» es
   que el estado viva junto al requisito.
2. **`traceability.md` pasa a generado**, con cabecera de «no editar a mano» y
   un `--check` en CI como el que ya tiene `docs:agent-contract`. Ahí desaparece
   la clase entera de conflictos, el driver de merge incluido.
3. **Un índice consultable** —`.specops/trace-index.json`, generado— para que
   `plan`, `status` y `alm` dejen de reparsear Markdown cada uno a su manera.
4. **La tabla se queda**, como artefacto de lectura. Es una ventaja real de este
   producto y no hay que perderla para ganar lo de arriba.

**El riesgo, dicho antes de empezar:** un fichero generado que la gente sigue
editando a mano es peor que uno editable, porque las ediciones se pierden en
silencio. Sin el `--check` en CI, la opción 2 es una regresión.

### 5.3 Por qué ReqIF se añade y no sustituye

Es un formato de intercambio: XML verboso, ilegible en un diff, pensado para que
DOORS hable con Polarion. Como formato de trabajo sería un retroceso frente a
Markdown. Como **exportación** es la llave para entrar en automoción, sanidad y
defensa, donde piden ReqIF por contrato — y con la matriz derivada (opción 2) es
un generador más, casi gratis.

---

## 6. Lo que **no** se propone

- **Base de datos o servicio.** El estado saldría del repositorio y dejaría de
  ser verificable por CI. Es la línea que este producto no cruza.
- **Sustituir Markdown por XML/YAML como formato de autoría.** Se perdería lo
  que hace revisables las specs en un PR.
- **Adoptar Doorstop/StrictDoc como motor.** Resolverían la trazabilidad y se
  llevarían por delante el modelo de `change`, los packs y el harness, que es
  donde está el valor propio.
- **Cambiar el formato para arreglar los conflictos.** Ya está arreglado, y el
  análisis dice que el tamaño mejoraba el problema, no lo empeoraba.

---

## 7. Recomendación

1. **Ahora: nada.** El formato aguanta tres órdenes de magnitud más de lo que
   nadie tiene, y el síntoma ya está resuelto.
2. **Cuando aparezca el primer proyecto de ~150 requisitos** —o cuando la
   duplicidad de estado muerda— hacer la opción 2, en este orden: un solo dueño
   del estado → índice generado → matriz generada con `--check`.
3. **ReqIF cuando lo pida un cliente**, como export, no como sustituto.

**El disparador que hay que vigilar**, para no decidir por intuición: el número
de filas del proyecto más grande, y si alguien edita la matriz a mano en lugar
de dejar que la escriban `req`, `done` y `change archive`. Lo segundo importa
más que lo primero: es la señal de que la proyección y la fuente se han
separado.

---

## 8. Fuentes

- [OpenFastTrace](https://github.com/itsallcode/openfasttrace) — y su
  [guía de usuario](https://github.com/itsallcode/openfasttrace/blob/develop/doc/user_guide.md)
- [Doorstop / StrictDoc / rmtoo, comparados](https://www.pistack.xyz/posts/2026-06-15-self-hosted-requirements-management-rmtoo-doorstop-strictdoc/)
- [StrictDoc — documentación](https://strictdoc.readthedocs.io/en/latest/latest/docs/strictdoc_03_faq.html)
- [Lista curada de herramientas de requisitos open source](https://gist.github.com/stanislaw/aa40eb7de9f522ad482e5d239c435ff8)
- [ReqIF (Requirements Interchange Format)](https://en.wikipedia.org/wiki/Requirements_Interchange_Format)
- [shtracer — matriz generada desde etiquetas](https://github.com/qq3g7bad/shtracer)
- [ReqView — gestión de requisitos sobre Git](https://www.reqview.com/)
- [Trazabilidad extremo a extremo en Azure DevOps](https://learn.microsoft.com/en-us/azure/devops/cross-service/end-to-end-traceability?view=azure-devops)
- [Perforce — cómo crear una matriz de trazabilidad](https://www.perforce.com/blog/alm/how-create-traceability-matrix)
