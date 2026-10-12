<!-- specgate:allow-placeholders — cita la sintaxis {{VAR}} de los packs. -->
# Análisis — «Spec-Driven Development for Enterprise Scale» (InfoQ)

> **Fuente:** https://www.infoq.com/articles/enterprise-spec-driven-development/
> **Escrito:** 2026-08-18, contra `create-spec-driven-app` v0.6.0
> **Pregunta:** ¿son viables estos conceptos para la herramienta que tenemos?

---

## Veredicto

**Sí, y en buena medida ya están construidos.** De los conceptos que el
artículo propone, la mayoría tiene implementación directa en el CLI de hoy.
Más interesante: **tres de los siete «huecos del tooling actual» que el artículo
denuncia son precisamente nuestras funciones distintivas.**

Pero hay una crítica suya que nos da de lleno y no tiene respuesta cómoda, y una
recomendación suya que **rechazo** con evidencia medida en este proyecto.

Resumen:

| | |
|---|---|
| Conceptos que ya cubrimos | 8 |
| Huecos reales nuestros | 3 |
| Recomendaciones que rechazo | 1 |
| Riesgo de colisión conceptual | 1, y es serio |

---

## 1. Lo que el artículo pide y ya tenemos

### 1.1 El flujo Discover → Design → Tasks

Su columna vertebral. La nuestra es el grafo de artefactos de ADR-0018,
comprobable ahora mismo con `csda schema which`:

```
proposal -> proposal.md          (requiere: —)
specs    -> specs/**/spec.md     (requiere: proposal)
design   -> design.md            (requiere: proposal)
tasks    -> tasks.md             (requiere: specs, design)
```

El mapeo es casi uno a uno: *Discover* ≈ `proposal`, *Design* ≈ `design`,
*Tasks* ≈ `tasks`. Con una diferencia a nuestro favor: **ellos describen fases,
nosotros modelamos dependencias.** ADR-0018 rechazó explícitamente la puerta de
fase porque «las puertas de fase son la razón de que el desarrollo dirigido por
especificación se gane fama de ceremonia». El artículo no llega a esa distinción
y arrastra el riesgo.

Además tenemos el grafo **configurable** (`csda schema fork`) y un segundo
built-in, `bdd-first`, que inserta `feature` antes de `specs`. El artículo pide
«flexibilidad de estilos» y lo lista como hueco; nosotros lo tenemos resuelto.

### 1.2 Integración con el backlog vía MCP

Lo plantea como recomendación de corto plazo. Tenemos **las dos mitades**:

- `csda alm sync` — Jira y Azure Boards: crea, cierra y reporta deriva
- `packages/mcp-spec-driven` — servidor MCP para que un agente lea specs y ejecute `validate`

Aquí vamos **por delante** del artículo, no por detrás.

### 1.3 Adopción brownfield incremental

Su recomendación textual: *«en lugar de intentar especificar retroactivamente
sistemas enteros, la exploración incremental es más práctica»*.

Es exactamente `csda adopt` (instala el esqueleto sin tocar código) y
`csda onboard` (lee el repo y **propone** capacidades con la evidencia de cada
una). Y el artículo lista «rutas de adopción brownfield poco claras» como hueco
del tooling actual.

### 1.4 Validación de alineación spec ↔ implementación

**Su hueco nº 4; nuestro núcleo.** La matriz de trazabilidad de diez columnas
más `validate --strict-tdd` es literalmente eso: un requisito sin escenario, sin
test o sin fila falla la build.

El artículo dice que esto no existe en las herramientas actuales. Existe.

### 1.5 Specs de tamaño revisable

Pide mantener las specs *«human reviewable»*. El ciclo de cambio emite **deltas**
—solo lo que se mueve, con marcadores ADDED/MODIFIED/REMOVED— en vez de copias
completas. Es la respuesta directa a su riesgo de «sobre-especificación».

### 1.6 Separación por ritmo de evolución y audiencia

Otro hueco que denuncia. Los **domain packs** son exactamente eso: conocimiento
de dominio versionado, fijado con digest e instalado como dependencia
(`.specops.lock`), con su propio ciclo, separado de las specs del proyecto que
cambian a diario.

### 1.7 El bug como señal de mejora del harness

Su bucle de retroalimentación. Nuestro equivalente operativo es
`specops contribute`: un cambio local vuelve **aguas arriba** al pack, así que
lo aprendido en un proyecto mejora el contexto de todos. Y `specops diff
--as-change` permite revisar la subida de versión **como intención**, no como
diff de ficheros.

### 1.8 Restricciones específicas por rol aplicadas automáticamente

Pide que los agentes superpongan las guías en vez de revisarlas a mano.
`AI_RULES.md` más `.harness/prompt-prefix.md` hacen eso: el prefijo se antepone
a **cada** prompt por requisito. En el pack móvil que añadimos, por ejemplo, las
restricciones son criterios de aceptación —offline como estado, rama de
denegación de permisos, revisión de store— y llegan solas al agente.

---

## 2. Los huecos que sí son nuestros

### 2.1 Orquestación multi-repositorio — **real, y el más grande**

Su hueco nº 1, y nos aplica. El artículo describe una fase *Design* que
**descompone en sub-issues por repositorio** y luego ejecuta en cada uno.

Nosotros tenemos `--project-dir` y un modo monorepo en `validate`, pero **una
spec no se descompone en varios repos**. La unidad es el proyecto.

Coste real: alto. Implica un identificador de trabajo por encima del repo,
correlación de estados y una matriz de trazabilidad federada. No es una función,
es un cambio de modelo.

**Mi recomendación: no ahora.** Es material de v2, y además `alm sync` ya cubre
el 80 % del caso — el issue de Jira *es* el identificador supra-repo, y cada
repo sincroniza contra él. Es menos elegante y mucho más barato.

### 2.2 Las specs viven solo en git — **la crítica que más duele**

Textual: *«las specs que viven únicamente en repositorios git crean fricción
para la colaboración interfuncional»*. Nos describe con precisión.

Y es una decisión **deliberada** nuestra: las specs viven en git porque eso es
lo que permite que CI las verifique, que la matriz sea auditable y que un cambio
de spec pase por revisión. Sacarlas de git destruye el gate.

**Pero la fricción que describe es cierta.** Un product owner no abre un PR.

Puente que ya existe a medias:
- `csda studio` — vista HTML local y de solo lectura del árbol de specs
- `csda report` — dashboard de cobertura autocontenido, artefacto de CI o Pages
- `csda alm sync` — el PO vive en Jira, no en el repo

**Recomendación:** no mover las specs. Invertir en que `studio` y `report` sean
publicables (Pages ya funciona) para que el no-desarrollador **lea** sin entrar
en git, y que `alm sync` sea el canal de escritura. La fuente de verdad sigue
siendo git; la audiencia cambia de superficie.

### 2.3 Agentes especializados por dominio

Habla de agentes de infraestructura, rendimiento y seguridad que aplican sus
restricciones automáticamente. Nosotros tenemos **un** agente por requisito, con
un prefijo de prompt común.

Coste: medio. Un `agent_profile` por dominio sería un paso natural — la
maquinaria de perfiles ya existe (`.harness/profiles.yaml`, añadida al arreglar
el piloto HIE). Falta la parte de decidir **qué** perfil aplica a qué requisito.

**Recomendación:** viable y barato como incremento. No urgente.

---

## 3. Lo que rechazo

### «Limitar la autoría directa de código a los agentes de IA; los humanos revisan specs»

Su recomendación de largo plazo. **No está respaldada por lo que hemos medido en
este proyecto, y nosotros somos el caso de uso.**

Evidencia de las tres ejecuciones reales del harness con Claude como agente
(2026-08-17, registradas en §12.11 del plan de cierre):

- **REQ-001**: el agente escribió 18 ficheros respetando las capas hexagonales.
  El escenario pasó. **Pero el gate que debía verificarlo no lo ejecutaba** — el
  requisito seguía en `Draft` y el comando de test no admitía sustitución. Que
  saliera bien fue el agente, no la comprobación.
- **REQ-002**: el agente hizo un trabajo **correcto** y el gate lo **rechazó en
  falso**, porque una clave de configuración en la rama base anulaba el filtro
  en silencio.
- **Tercera ejecución**: falló por límite de gasto de la cuenta, y sin los
  arreglos habría borrado 861 líneas de trabajo válido.

Una ejecución del bucle destapó **diez defectos** en la propia maquinaria. La
conclusión honesta no es «los humanos dejan de escribir código», sino:

> Antes de retirar al humano de la escritura, hay que poder confiar en la puerta
> que sustituye su revisión. Nosotros descubrimos, ejecutando, que la nuestra
> aprobaba trabajo sin verificarlo. Esa es la lección, y el artículo no la tiene
> porque no reporta haber ejecutado nada.

El artículo hace afirmaciones de organización sin evidencia de operación. Lo
adopto como **dirección**, no como práctica.

---

## 4. El riesgo que nadie ve: colisión de «harness»

**Serio y merece decisión.**

- Para el artículo, *harness* = el **contexto** que se le da al agente. «Harness
  governance» = calidad de las specs. «Cada hueco fortalece el harness».
- Para nosotros, `csda harness` = el **bucle de ejecución** que lanza el agente.

Son cosas distintas con el mismo nombre. Si el vocabulario del artículo cuaja en
el sector —y viene de InfoQ, así que puede— vamos a tener que explicar la
diferencia en cada conversación.

**Opciones:**

1. **No hacer nada.** El nuestro es un comando concreto, el suyo un concepto
   difuso. El contexto desambigua casi siempre.
2. **Renombrar el nuestro** a `csda run` o `csda loop`. Es breaking, y ahora
   mismo tenemos dos releases seguidas sin romper nada — no lo gastaría en esto.
3. **Apropiarse del término**: documentar que nuestro «harness» ejecuta y que el
   contexto que consume son `AI_RULES.md` + el pack + el prefijo, que es su
   «harness». Alinea sin romper.

**Recomiendo la 3.** Cuesta un párrafo en `docs/agents.md`.

---

## 5. Métricas que propone, y cuáles podemos dar hoy

| Métrica del artículo | ¿Podemos? | Cómo |
|---|---|---|
| Frecuencia de huecos spec↔implementación | **Sí** | `csda report` ya cuenta requisitos sin test/código |
| Efectividad del mecanismo de validación | **Sí, ahora** | Ratio de fallos reales frente a falsos del gate. Los tres runs dan la primera muestra |
| Completitud de la elicitación | Parcial | `validate` detecta campos ausentes, no ambigüedad |
| Tiempo de ciclo de revisión de specs | No | Necesita datos del historial de PRs |

La segunda es la que más nos conviene instrumentar: **es la que descubrimos que
estaba rota.**

---

## 6. Recomendación, en orden

1. **Adoptar su vocabulario donde ya coincidimos.** Discover/Design/Tasks es
   comprensible para un comité de arquitectura; `proposal/design/tasks` no lo es
   fuera del repo. Un párrafo de equivalencias en `docs/`, coste casi cero.
2. **Resolver la colisión de «harness»** con la opción 3.
3. **Publicar `studio` y `report`** como superficie de lectura para no
   desarrolladores. Ataca su crítica más certera sin tocar la fuente de verdad.
4. **Instrumentar la efectividad del gate.** Es nuestra métrica y está viva.
5. **Perfiles de agente por dominio** cuando haya demanda. La maquinaria existe.
6. **Multi-repo, a v2.** Mientras, `alm sync` es el puente barato.
7. **No** adoptar «solo agentes escriben código» hasta que la puerta demuestre
   que distingue trabajo bueno de malo. Hoy sabemos que no lo hacía.

---

## 7. Lectura final

El artículo es **buena estrategia y ninguna operación**. Describe correctamente
hacia dónde va esto y nombra siete huecos de tooling de los que **tres son
nuestras funciones distintivas** — señal de que el producto está apuntando al
sitio correcto.

Donde falla es donde nosotros hemos aprendido más: no dice nada de qué pasa
cuando el bucle se ejecuta de verdad. Nosotros lo ejecutamos tres veces y
encontramos diez defectos, uno de ellos —un gate que aprobaba sin comprobar— que
invalidaba la premisa entera del producto.

Esa diferencia es defendible como posición: **ellos tienen el marco, nosotros
tenemos las cicatrices.**
