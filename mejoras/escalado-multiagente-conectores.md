<!-- specgate:allow-placeholders -->
# Escalado — harness multiagente, conectores ALM y csda como plugin de hosts

> **Creado:** 2026-08-20
> **Estado del proyecto al escribirlo:** v0.6.0, rama `fix/brownfield-onboarding-java`
> **Relación con otros documentos:** este fichero no sustituye a
> `mejoras/plan-cierre-enterprise.md`. Aquel gobierna el camino a 1.0 (§12.10);
> este propone lo que viene **después**, y dice explícitamente qué parte de ello
> puede entrar antes sin poner en riesgo el gate G1.

---

## 0. Veredicto en una tabla

| Idea | Veredicto | Por qué | Cuándo |
|---|---|---|---|
| **1 · Harness multiagente** | **Sí, pero en tres fases y sin construir un runtime propio** | La pieza que falta no es "más agentes", es el **grafo de dependencias entre requisitos** (H12). Con él, el paralelismo sale casi gratis porque cada REQ ya corre en su propio worktree. Los roles de agente vienen después, y como *asesores*, nunca sustituyendo la puerta determinista | Fase A tras 1.0 · Fases B y C en v2 |
| **2 · Conectores de planificación (Jira, YouTrack, …)** | **Sí. Es la de mayor valor por euro y la que menos mueve el centro** | Ya existe `csda alm sync` con dos proveedores reales. El trabajo no es "añadir YouTrack", es **extraer el puerto y publicar un kit de conformidad** para que añadir un proveedor sea una fila y no un fork | Extracción del puerto: seguro antes de 1.0 (es refactor interno). Proveedores nuevos: 1.1 |
| **3 · csda como plugin de Claude Code / Copilot / Antigravity** | **Sí, y es el alcance más barato — pero primero hay que arreglar una duplicación de casa** | El contenido ya existe dos veces: seis pasos en `scripts/agents/commands.ts` y siete herramientas en `packages/mcp-spec-driven/src/tools.ts`, mantenidas por separado. Unificarlas en un registro único es el trabajo real; el empaquetado por host es lo fácil | Registro único: antes de 1.0 · Plugin de Claude Code con hooks: 1.1 |

**La frase que resume las tres:** ninguna de ellas cambia lo que csda *es*. La
spec sigue siendo el contrato y `validate` sigue siendo quien dice la verdad.
Lo que cambia es cuánta gente y cuántas máquinas pueden tocar ese contrato sin
romperlo. Ese es el eje sobre el que hay que decidir cada tarea de aquí abajo:
**si una propuesta necesita que la spec deje de ser el centro, se rechaza.**

---

## 1. Punto de partida verificado

Comprobado contra el disco el 2026-08-20. No hace falta repetir esta lectura.

### 1.1 El harness hoy

`scripts/harness/run.ts` (717 líneas) hace, por cada requisito pendiente:

1. `plan --format json` da la cola.
2. Un worktree de git aislado, rama `harness/REQ-NNN`.
3. `buildPrompt()` arma un prompt autocontenido (Gherkin + `AI_RULES.md` +
   rutas + realimentación del intento anterior).
4. Shell-out al comando del usuario, con el marcador `{prompt_file}`.
5. Puerta: `validate --strict-tdd` + el comando de test del proyecto.
6. Verde → `done` + commit. Rojo → reintento alimentando el fallo.
7. Nunca mergea.

Propiedades que hay que **preservar**, porque son las que lo hacen distinto:

- **El agente es un comando de shell.** No hay SDK, no hay proveedor. Esa
  neutralidad es el foso del producto; cualquier diseño que la rompa está mal.
- **La señal de recompensa es determinista.** `validate --strict-tdd` + tests.
  La inmensa mayoría de los frameworks multiagente meten un juez LLM porque no
  tienen puerta real. Nosotros la tenemos: usarla es la ventaja.
- **El estado compartido es el repositorio.** `plan`, `status`, la matriz de
  trazabilidad y los ficheros `.feature` son la pizarra. Es durable, inspeccionable
  y verificable por CI, cosa que ninguna memoria de proceso lo es.
- **Aislamiento por worktree.** Ya es paralelizable; simplemente no se paraleliza.

Lo que **no** existe: dependencias entre requisitos (H12), paralelismo, roles,
escalado de modelo entre intentos, y un registro de ejecución legible por máquina.

### 1.2 El ALM hoy

`scripts/alm/core.ts` (178 l.) + `scripts/alm/clients.ts` (156 l.):

- Proveedores: `jira` (Cloud, Basic auth) y `azure` (Boards, PAT).
- Interfaz mínima ya aislada: `{ createIssue, getIssueStatus, closeIssue }`,
  inyectable — la lógica se testea offline.
- Mapeo persistido y versionado en `.specops/alm-map.json`; da idempotencia.
- Detección de deriva: issue cerrado con el REQ abierto → DRIFT.
- Credenciales solo por nombre de variable de entorno, nunca en el fichero.

Es decir: **el patrón puerto/adaptador ya está**, sin nombrarse. Lo que falta es
formalizarlo y probarlo como contrato.

Lo que **no** existe: reintentos con backoff, paginación, mapeo de campos
personalizados, enlace inverso (del issue a la spec), y ninguna vía de entrada
desde el ALM hacia el repositorio.

### 1.3 La integración con hosts de agente hoy

Dos superficies, mantenidas por separado:

| Superficie | Qué es | Fichero | Problema |
|---|---|---|---|
| `csda agents init` | Escribe ficheros de instrucciones para 8 herramientas: claude, cursor, copilot, windsurf, aider, gemini, cline, codex | `scripts/agents/init.ts`, pasos en `scripts/agents/commands.ts` | Es **texto estático**. Se genera una vez y a partir de ahí deriva. Mitigado en parte porque cada paso delega en `csda change instructions`, que sí lee del motor |
| Servidor MCP | 7 herramientas vivas: `read_spec`, `list_requirements`, `update_traceability`, `lint_pack`, `validate_project`, `plan`, `mark_requirement_done` | `packages/mcp-spec-driven/src/tools.ts` | Es una **tercera** definición de la superficie, junto a los 12 comandos del contrato de agente y los 6 pasos. Nada obliga a que las tres coincidan |

La regla que el propio repositorio aplica en todas partes —"escrito una vez,
generado en muchos formatos"— está aplicada dentro de `agents init` (los 6 pasos
se definen una vez) pero **no entre las tres superficies**. Ahí está la deuda.

---

## 2. Idea 1 — El harness multiagente

### 2.1 El diagnóstico honesto

"Multiagente" es hoy la palabra con peor relación señal/ruido del sector. La
mayoría de las implementaciones son un bucle de LLMs criticándose entre sí, y
producen demos impresionantes y diffs que nadie puede revisar. Antes de aplicar
ningún patrón hay que preguntarse qué problema resuelve **aquí**.

El harness tiene tres problemas medidos, y solo uno de ellos es de agentes:

| Problema | ¿Lo arregla más agentes? |
|---|---|
| **H12 · Los requisitos dependientes no se expresan.** REQ-002 se apoya en REQ-001 y hay que saberlo y pasar `--base-branch` a mano; sin `--req`, el harness procesa en orden de matriz y falla en cascada | **No.** Lo arregla un grafo. Pero es la precondición de todo lo demás |
| **H9 · `--base-branch` hereda la configuración de la base.** El fallo falso de REQ-002 fue exactamente esto | **No.** Lo arregla un aviso cuando la base va por detrás de `main` |
| **Un intento fallido reintenta con lo mismo.** El prompt cambia (lleva el fallo), pero el agente y el modelo son idénticos | **Sí, parcialmente.** Aquí sí hay valor en cambiar de rol o de modelo |

Conclusión: **el paralelismo y el grafo valen más que los roles**, y hay que
hacerlos primero. Un harness que procesa cinco requisitos independientes a la
vez multiplica el rendimiento por cinco con un único agente. Un harness con
cuatro roles y un solo requisito multiplica el gasto por cuatro y el rendimiento
por poco.

### 2.2 Fase A — El grafo y el paralelismo *(cierra H12, mitiga H9)*

**Modelo.** Declarar dependencias entre requisitos. El sitio natural es la
matriz de trazabilidad (una columna) y el pack (los packs ya declaran
`requirement_id` por escenario, pero no relaciones entre requisitos). El grafo
resultante es un DAG; los ciclos son un error de validación con su `fix`, no un
cuelgue en tiempo de ejecución.

**Ejecución.** `plan` ordena topológicamente y agrupa en niveles. Cada nivel es
un conjunto de requisitos mutuamente independientes → se lanzan en paralelo con
un pool de N trabajadores (`--concurrency`, por defecto 1 para no cambiar el
comportamiento actual sin pedirlo). Un requisito solo entra en cola cuando todos
sus predecesores están verdes; si uno falla, sus descendientes se marcan
`skipped: blocked by REQ-NNN` en vez de fallar en cascada.

**Base de cada worktree.** Aquí vive H9. Con el grafo, la base correcta de un
requisito es la rama de su predecesor, no `main` ni el HEAD actual — y el
harness puede calcularlo en vez de exigir `--base-branch` a mano. Cuando la base
elegida va por detrás de `main`, se avisa; no se corrige en silencio.

**Lo que no cambia:** cada requisito sigue en su worktree, la puerta sigue siendo
la misma, y sigue sin mergear nada.

**Riesgo a nombrar:** N ramas verdes en paralelo son N revisiones humanas en
paralelo. El paralelismo mueve el cuello de botella del agente al revisor, no lo
elimina. Por eso `--concurrency` por defecto es 1 y subirlo es una decisión
consciente de quien va a revisar.

### 2.3 Fase B — Roles, y dónde se permiten

Un rol es **un perfil de `.harness/profiles.yaml`**, no una clase nueva. Ya
existe `agent_profile`; basta con permitir varios por ejecución. Así el contrato
"un agente es un comando de shell" sobrevive intacto.

| Rol | Qué hace | Qué puede escribir | Obligatorio |
|---|---|---|---|
| `implementer` | Lo que hace hoy el agente único | Código y tests. Nunca `features/**` ni `docs/specs/**` | Sí — es el actual |
| `reviewer` | Lee el diff del intento y produce hallazgos, **asesores** | Nada. Solo devuelve texto | No |
| `repairer` | Reintento con los hallazgos del revisor **más** la salida de la puerta | Igual que `implementer` | No |
| `spec-author` | Redacta la propuesta y el delta de un `change` | Solo dentro de `changes/<id>/`, y valida con `csda change validate` | No |

**La regla dura, y es la que separa esto de un juguete:** el revisor **nunca**
puede aprobar. Su salida es entrada del siguiente prompt, no una decisión.
`validate --strict-tdd` + los tests siguen siendo el único juez. Un hallazgo del
revisor con la puerta en verde no bloquea; se anota en el informe para el humano.

**Escalada entre intentos.** Hoy los tres intentos son idénticos salvo el
prompt. Con perfiles, la escalera natural es: intento 1 `implementer`; intento 2
`reviewer` → `repairer`; intento 3 `repairer` con un perfil más capaz (o más
presupuesto de razonamiento). Se declara en `harness.config.yaml`, con la
escalera de un solo peldaño —el comportamiento de hoy— como valor por defecto.

### 2.4 Fase C — Observabilidad y coste

Multiagente multiplica el gasto, y ahora mismo el harness no lleva cuentas. Sin
esto, la fase B es imposible de justificar ante nadie que pague la factura.

Un registro por ejecución en `.harness/runs/<timestamp>.json`: por requisito,
intentos, rol de cada intento, duración, código de salida, resultado de la
puerta, y —cuando el agente lo reporte por stdout o por un fichero de uso—
tokens y coste. Es el mismo patrón que ya usa `alm-map.json`: un fichero JSON
versionado que convierte una ejecución en un hecho consultable.

De ahí sale casi gratis un `csda harness report`, y de ahí la métrica que de
verdad importa y que hoy nadie mide: **coste por requisito entregado y tasa de
acierto al primer intento.**

### 2.5 Lo que se rechaza de la idea 1

- **Un runtime o SDK de agentes propio.** Mata la neutralidad, que es el foso.
- **Un bus de mensajes o memoria compartida entre agentes.** La pizarra es el
  repositorio. Un canal lateral crea estado que CI no puede verificar, que es
  exactamente el fallo que este proyecto existe para arreglar.
- **Un juez LLM en la puerta.** Tenemos puerta determinista. Cambiarla por una
  opinión sería regalar la única ventaja estructural del producto.
- **Agentes que negocian el alcance entre sí.** El alcance lo fija la spec. Si
  la spec es ambigua, eso es un `change`, no una negociación.

---

## 3. Idea 2 — Conectores de herramientas de planificación

### 3.1 Es viable porque ya está medio hecho, y el centro no se mueve

La pregunta de fondo —"¿mantiene el centro?"— tiene una respuesta precisa, y hay
que escribirla antes de tocar código:

> **El ALM es un espejo, no una fuente de verdad.** La spec y la matriz son el
> contrato. Un issue de Jira o de YouTrack refleja un requisito; nunca lo
> define. Y cualquier flujo de entrada desde el ALM entra por el ciclo de
> `change`, jamás escribiendo directamente en la matriz.

Con esa regla, los conectores no son un riesgo de dilución: son distribución.
Sin ella, en tres versiones el producto es un cliente de Jira con specs de
adorno.

Hay además una razón concreta para invertir aquí: §12.12 registra que **P1
(orquestación multi-repositorio) usa hoy el issue del ALM como identificador
supra-repo — "feo y barato"**. Un puerto ALM bien hecho convierte ese apaño en
una capacidad declarada. Es el único camino barato hacia P1 antes de v2.

### 3.2 El trabajo real: extraer el puerto y publicar un kit de conformidad

Hoy `makeClient` es un `switch` sobre dos proveedores en un fichero. Eso escala
mal a seis. Lo que hay que construir:

1. **`AlmProvider` como puerto documentado.** La interfaz de tres métodos ya
   existe de hecho; hay que nombrarla, versionarla y ampliarla mínimamente:
   `createIssue`, `getIssueStatus`, `closeIssue`, `linkBack(issueKey, specUrl)`,
   `capabilities()`. `capabilities()` es lo que evita el peor fallo de diseño de
   estos conectores: fingir que todos los ALM saben hacer lo mismo. YouTrack no
   tiene `statusCategory`; Linear no tiene tipos de issue de Jira; GitHub Issues
   no tiene transiciones. Un proveedor declara lo que sabe hacer y el núcleo
   degrada con un aviso en vez de romper.
2. **Un kit de conformidad.** Una suite de tests que cualquier proveedor debe
   pasar, contra respuestas grabadas. Es el mismo razonamiento que ya se aplicó
   a los packs curados ("un test instala cada uno"): sin ella, seis proveedores
   son seis fuentes de regresiones silenciosas.
3. **Robustez que hoy falta y que en un ALM corporativo aparece el primer día:**
   reintento con backoff ante 429/5xx, paginación, timeouts, y un `--dry-run`
   que ya existe pero que debe cubrir también las escrituras nuevas.

### 3.3 Los proveedores, por orden

| Proveedor | Coste | Nota técnica |
|---|---|---|
| **YouTrack** | Bajo | REST `/api/issues`, token permanente en cabecera `Bearer` (no Basic, a diferencia de Jira). El estado es un **campo personalizado** de tipo bundle, así que "hecho" no se deduce de una categoría: hay que configurar `state_field` y `done_state`. La config ya tiene `done_state` para Azure; se generaliza |
| **GitHub Issues** | Muy bajo | Vía `gh` o REST. Cierra el círculo para equipos que ya viven en GitHub y no tienen Jira. Probablemente el segundo más usado tras Jira |
| **Linear** | Bajo | GraphQL. Estados por workflow de equipo |
| **GitLab Issues** | Bajo | Simétrico a GitHub |
| **Jira Data Center / Server** | Medio | Auth y rutas distintas de Cloud. Es el que de verdad piden las empresas grandes, y el que más soporte genera |

**Modelo de dos niveles, para que el mantenimiento no se coma el repositorio:**
*core* (`jira`, `azure`, `github`) mantenidos aquí con el kit de conformidad en
CI; *comunidad* resueltos por nombre de paquete (`provider: npm:csda-alm-youtrack`).
Es la misma lógica de D9/D12, que ya sacó la distribución de plugins a v2: cada
adaptador es una API ajena que cambia sin avisar, y eso no puede vivir todo en
el árbol principal.

### 3.4 La entrada desde el ALM: `alm pull --as-change`

Es la petición que llegará de cualquier empresa —"el PO abre el ticket en Jira,
que aparezca en el repo"— y es donde se pierde el centro si se implementa mal.

La forma correcta ya existe en el producto y se llama `specops diff --as-change`:
lo que entra de fuera entra **como propuesta revisable**, no como hecho
consumado. Aplicado aquí: `csda alm pull` toma issues etiquetados, abre un
`change` con una propuesta y un delta prerrellenados desde el título y la
descripción, y **deja los escenarios Gherkin vacíos a propósito**. Un ticket de
Jira no contiene criterio de aceptación ejecutable; fingir que sí lo contiene
sería precisamente el "documentar produce un texto que nadie relee" contra el
que argumenta §12.13.

Ese hueco vacío no es una carencia: es el sitio donde el equipo (o el rol
`spec-author` de la idea 1) hace el único trabajo que no se puede automatizar.

### 3.5 Lo que se rechaza de la idea 2

- **Webhooks / modo servidor.** Exige un proceso escuchando, con su hosting y su
  seguridad. El CLI es sin estado y debe seguir siéndolo; la sincronización va
  en CI, por cron, que es donde ya vive.
- **Sincronización bidireccional de estado libre.** Si Jira puede reabrir un
  requisito cerrado en la matriz, hay dos fuentes de verdad y ninguna gana. La
  deriva se **reporta**, como ahora; no se resuelve automáticamente.
- **Guardar credenciales en el fichero de configuración.** Ya está bien resuelto
  (solo nombres de variables) y no se toca.

---

## 4. Idea 3 — csda como plugin de los hosts de agentes

### 4.1 El trabajo de casa primero: un registro único de superficie

Hoy la superficie de csda está descrita en tres sitios que nada obliga a
mantener sincronizados: los 12 comandos del contrato de agente, los 6 pasos de
`scripts/agents/commands.ts`, y las 7 herramientas de
`packages/mcp-spec-driven/src/tools.ts`. Añadir un comando nuevo hoy no aparece
en MCP salvo que alguien se acuerde.

**Antes de empaquetar para ningún host hay que colapsar eso en un registro
único**, del que se generen: la tabla de despacho del CLI, las herramientas MCP,
el documento del contrato de agente (`docs:agent-contract` ya se genera y tiene
`--check`, así que el patrón está probado) y los ficheros por host. Un comando
nuevo aparece en todas partes o en ninguna.

Este es el trabajo real de la idea 3. El empaquetado por host, una vez hecho
esto, es casi mecánico.

### 4.2 Claude Code — de ficheros de instrucciones a plugin de verdad

Es el host donde más se puede ganar, porque su superficie de extensión es la más
rica: plugins empaquetables (comandos + skills + subagentes + hooks + servidores
MCP en una unidad instalable), y sobre todo **hooks**.

Hoy csda escribe seis comandos de barra y un `AGENTS.md`. Un plugin completo
llevaría:

| Pieza | Contenido | Valor |
|---|---|---|
| Comandos | Los 6 pasos, ya definidos | Igual que hoy |
| Servidor MCP | El que ya existe, declarado en el plugin | El agente lee specs en vivo en vez de leer un fichero congelado |
| Subagentes | Los roles de la idea 1 (`reviewer`, `spec-author`) | Reutiliza el diseño en el host interactivo, no solo en el harness |
| **Hooks** | `validate --json` tras editar, y bloqueo al cerrar la sesión si `--strict-tdd` falla | **Esto es lo diferencial** |

Los hooks merecen el subrayado. La tesis entera del producto es "la puerta falla
cuando falta algo". Hoy esa puerta actúa en CI, es decir, **después** de que el
agente haya terminado y se haya ido. Un hook la mete **dentro** del bucle del
agente: la sesión no se cierra en verde con un requisito sin test. Eso convierte
csda de "lo que revisa el trabajo del agente" en "lo que el agente no puede
saltarse", y no conozco ninguna otra herramienta de specs que lo haga.

### 4.3 GitHub Copilot — realista, no ambicioso

Dos superficies distintas y conviene no confundirlas:

- **Instrucciones + MCP.** `.github/copilot-instructions.md` ya se genera, y
  Copilot en VS Code consume servidores MCP. Con el registro único de §4.1, esto
  es coste cero adicional. **Hacerlo.**
- **Una Copilot Extension (GitHub App alojada).** Es otro producto: requiere
  hosting, credenciales, ciclo de publicación y soporte. Es exactamente el mismo
  razonamiento por el que D12 mandó a v2 los plugins de Maven/Gradle y el
  registry. **No hacerlo ahora.**

### 4.4 Antigravity CLI — verificar antes de prometer

Aquí hay que ser honesto: **no tengo confirmado el formato de extensión de
Antigravity a día de hoy**, y comprometer una tarea contra un formato supuesto
es la forma más barata de generar trabajo inútil. La primera tarea de esta línea
es una hora de lectura de su documentación, no código, y tiene tres desenlaces:

1. **Habla MCP** → coste cercano a cero; ya está cubierto por el servidor actual.
2. **Lee `AGENTS.md`** → ya está cubierto por las filas `codex` / `gemini` de
   `scripts/agents/init.ts`; sería una fila más en `TOOLS`.
3. **Tiene formato propio de plugin** → una fila nueva, coste comparable al de
   Cursor o Windsurf, que ya están.

En los tres casos el coste es bajo *porque el registro único existe*. Ese es el
argumento de por qué §4.1 va primero.

### 4.5 El principio que ordena toda la idea 3

**Una definición, muchos empaquetados; y una sola superficie viva.** Los
ficheros de instrucciones son texto que deriva; MCP es una conexión que no
puede derivar porque lee del motor. Por eso la dirección estratégica es que
**MCP sea la superficie principal** y los ficheros de instrucciones queden como
el escalón de compatibilidad para hosts que no hablan MCP — no al revés.

---

## 5. Cómo encajan las tres: el plano de control

Puestas juntas, las tres ideas no son tres funcionalidades sueltas: son las tres
caras que le faltan a una misma pieza.

```
              ┌───────────────────────────────────────┐
   Idea 2 ──▶ │  ALM (Jira · YouTrack · Boards · GH)   │  planificación
              └───────────────────┬───────────────────┘
                    espejo, entra por `change`
                                  ▼
              ┌───────────────────────────────────────┐
              │   LA SPEC — spec.md · features/ ·     │  ◀── el centro
              │   docs/specs/traceability.md          │      no se mueve
              └───────┬───────────────────────┬───────┘
                      │                       │
        Idea 3 ──▶ hosts de agente      Idea 1 ──▶ harness
        (Claude Code · Copilot ·        (DAG · paralelo ·
         Antigravity · MCP)              roles · coste)
                      │                       │
                      └───────────┬───────────┘
                                  ▼
              ┌───────────────────────────────────────┐
              │  validate --strict-tdd + tests + CI   │  el único juez
              └───────────────────────────────────────┘
```

Leído así, la propuesta completa se enuncia en una frase: **csda deja de ser un
CLI de specs y pasa a ser el plano de control entre lo que la empresa planifica,
lo que los agentes ejecutan y lo que CI verifica** — sin que ninguna de las tres
puntas pueda decidir por su cuenta qué es verdad.

Y hay una consecuencia práctica de este dibujo: las tres ideas comparten una
misma pieza pendiente, el **registro único de superficie** (§4.1). El grafo de
requisitos lo consume `plan`, el conector lo consume `alm`, y los hosts lo
consumen todos. Hacerlo una vez habilita las tres; no hacerlo obliga a
mantenerlas por triplicado.

---

## 6. Riesgos transversales

| # | Riesgo | Mitigación |
|---|---|---|
| R1 | **Las tres ideas añaden superficie, y G1 exige dos releases sin roturas.** Ninguna de las tres avanza G3 (un equipo externo que adopte y reporte), que es el que de verdad bloquea 1.0 | Solo entran antes de 1.0 los **refactores internos sin cambio de contrato**: registro único (§4.1) y extracción del puerto ALM (§3.2). Todo lo demás es 1.1 o v2 |
| R2 | **El paralelismo traslada el cuello de botella al revisor humano** | `--concurrency` 1 por defecto. El informe de ejecución debe ordenar por riesgo, no por orden de finalización |
| R3 | **Cada conector y cada host son una API ajena que cambia sin avisar** | Modelo de dos niveles (core / comunidad) y kit de conformidad con respuestas grabadas |
| R4 | **Multiagente multiplica el gasto sin que hoy nadie lo mida** | La fase C (registro de ejecución y coste) es **precondición** de la fase B, no una mejora posterior |
| R5 | **Deriva entre las tres superficies de comandos** — ya existe hoy | El registro único, con un `--check` en CI como el que ya tiene `docs:agent-contract` |
| R6 | **Que los conectores conviertan el producto en un cliente de Jira** | La regla de §3.1, escrita en un ADR: el ALM es espejo; la entrada va por `change` |

---

## 7. Secuenciación propuesta

IDs con el mismo formato que `mejoras/plan-cierre-enterprise.md`, para que se
puedan citar en los commits.

### Antes de 1.0 — solo refactor interno, sin cambio de contrato

| ID | | Tarea | Idea |
|---|---|---|---|
| `E0-01` | `[x]` | Registro único de superficie: despachador, ambos perfiles de ayuda, completion, contrato de agente y herramientas MCP leen una sola declaración — `06be948`, `21a435a`, `1d35caf` | 3 |
| `E0-02` | `[x]` | `AlmProvider` extraído como puerto documentado, con capacidades declaradas, kit de conformidad sobre respuestas grabadas y `docs/alm.md`. Jira y Azure son sus dos primeras implementaciones | 2 |
| `E0-03` | `[x]` | [ADR-0021](../docs/specs/adr/0021-alm-is-a-mirror.md) — el ALM es un espejo; el estado fluye matriz → tablero y nunca al revés; la entrada externa llega como `change`. Dos guardas ejecutables, no una declaración | 2 |

### Migración TypeScript de `scripts/` — completa *(2026-08-20)*

Decisión del usuario, aplicada solo a los ficheros escritos en esta sesión:
ESM, interfaces, cero `any`, clases donde el dominio ya es una.

| Fichero | Qué pasó a ser |
|---|---|
| `scripts/alm/port.ts` | Interfaces del contrato: `AlmClient`, `AlmProvider`, `AlmCapabilities`, `IssueRef`, `IssueStatus`, `FetchLike` |
| `scripts/alm/providers/http-client.ts` | `abstract class HttpAlmClient` — credencial, URL base y `request/requestJson` compartidos |
| `scripts/alm/providers/{jira,azure}.ts` | `class JiraClient extends HttpAlmClient` con `private readonly` + su descriptor `AlmProvider` |
| `scripts/lib/requirement-graph.ts` | `class RequirementGraph` con `fromProject` / `fromDependencies`, y `transitiveDependents` traído aquí desde `harness/run.ts`, que es donde no debía estar |

**Cero `any` y cero CJS en los siete ficheros**, con una excepción explicada en
el código: `change/parser.ts` es `module.exports =` y un `import` con nombre
contra un módulo de export-assignment no compila (TS2459), así que se cruza con
`require()` — que es literalmente lo que `AI_RULES.md` prescribe.

**No hizo falta tocar `AI_RULES.md`.** La regla dice *«match the file you are
editing»* y reconoce que *«the newer files use ESM syntax»*: estos son ficheros
nuevos, así que el refactor va con la regla, no contra ella. Convertir los
ficheros ajenos sí requeriría cambiarla, y es otra decisión.

**Lo que hizo el refactor seguro:** los 39 tests de ALM y los 31 del grafo y el
scheduler existían **antes**, así que el kit de conformidad es quien prueba que
reescribir dos conectores como clases no cambió una sola respuesta HTTP.
Refactorizar sin esa red habría sido adivinar.

**Ampliado a todo `scripts/` por decisión del usuario**, tras verificar el
piloto. 71 ficheros, 19.688 líneas.

| | Antes | Después |
|---|---|---|
| Ficheros con `module.exports` | 51 | **0** |
| Ficheros con `require()` | 60 | **2** |
| Ocurrencias de `any` | 57 | **0** |
| Interfaces/types exportados | — | **54** |

Los dos `require()` que quedan son irreductibles y están comentados: un
especificador de `import` debe ser estático, y `ci_init.ts` y
`expand_domain_pack.ts` leen `package.json` por una ruta que se calcula en
tiempo de ejecución (difiere entre `scripts/` y `dist/scripts/`).

**Cómo se hizo sin romper nada.** Un codemod conservador para la parte mecánica
—`require` → `import`, `module.exports` → `export`— aplicado **en seis capas,
de las hojas hacia arriba**, con typecheck y las 806 pruebas entre cada una. El
orden importa: convertir un fichero a `export` no rompe a quien lo consume con
`require()`, pero un `import` con nombre contra un módulo de export-assignment
no compila. De abajo arriba, nunca hay un paso intermedio roto.

**Lo que la migración destapó, que es el argumento para haberla hecho.** Al
dejar de pasar por `require()` —que devuelve `any` y por tanto lo permite
todo— aparecieron defectos latentes reales:

| Defecto | Cómo se veía |
|---|---|
| `resolveProjectDir(explicit, opts)` declaraba `opts` obligatorio | **12 llamadas** pasan un argumento. El cuerpo hace `opts && opts.requireSentinel`: la firma era la mentira |
| `agentIo.emit(payload, renderHuman)` igual | El cuerpo hace `else if (renderHuman)`. Dos llamadas pasaban uno |
| `runInitWizard(io)` igual | `io` es la costura de inyección para tests; el uso interactivo no pasa nada |
| `agent.error.code` en el harness | Node lanza un `ErrnoException`; el tipo declarado era `Error`, que no tiene `code` |
| El AST del parser **cambia de forma a mitad de vuelo** | `text` y `body` son `string[]` mientras `parseMarkdown` acumula y `string` tras `trimBlock`. Ahora está modelado y se lee con `blockText` |
| `UpdateResult.outcome` | Supuse `"merged"`; el tipo me corrigió: es `"updated"` |

Ninguno rompía en producción hoy. Todos eran una llamada de distancia de
hacerlo.

**Piezas que pasaron a ser clases, porque el dominio ya lo era:**
`abstract class HttpAlmClient` (credencial, URL base y `request/requestJson`
compartidos) con `JiraClient` y `AzureClient` extendiéndola; y
`class RequirementGraph`, que además se llevó `transitiveDependents` desde
`harness/run.ts`, donde no debía estar. Los scripts de comando **siguen siendo
funciones**: convertirlos a clases chocaría con «un fichero por comando, el
despachador nunca implementa lógica».

**`AI_RULES.md` sí hubo que cambiarlo esta vez.** Su sección «Module style»
decía «match the file you are editing» y describía un árbol mixto que ya no
existe; dejarla habría sido una regla mintiendo. Ahora dice ESM en todo
`scripts/`, nombra los dos `require()` supervivientes, y añade una sección
«Typing» con las dos costuras que todo atraviesa (`AgentIo`/`Diagnostic` y el
AST de `change/parser.ts`). `strict` **sigue desactivado**: encenderlo es su
propia decisión con su propia migración.

**Verificado ejecutando, no solo compilando:** `--help --all`, `validate`,
`status --json`, `plan --json`, `doctor --json`, `change status --json`,
`completion zsh`, un `init` completo con `validate` sobre el proyecto generado,
y el harness en paralelo con la cascada de bloqueo. 759 unit · 22 BDD · 89 en
paquetes · `verify` · `selfcheck` · contrato al día.

**Nota:** `git stash@{0}` conserva la conversión a medias que había en el árbol
antes de empezar. Está enteramente superada —todo lo que contiene existe ahora
en versión más nueva— y se puede soltar con `git stash drop`.

---

### Lo que salió al hacer E1-05 *(2026-08-20)*

**Primero verificar, después escribir.** El esquema de plugins no me lo sabía
con la precisión que hace falta, y un manifiesto inventado produce un plugin que
no carga. Comprobado contra la referencia oficial antes de una sola línea:
`.claude-plugin/plugin.json` es el manifiesto, **todos** los directorios de
componentes van en la raíz del plugin y nunca dentro de `.claude-plugin/`, y
—lo decisivo— un hook `Stop` que sale con **código 2 bloquea la parada** y su
stderr es lo que se le dice al agente.

**El problema de diseño real no era el formato, era el bucle.** Un hook que
bloquea siempre que el gate está rojo puede atrapar una sesión para siempre:
intenta, falla, se bloquea, intenta. Por eso bloquea **una vez por prompt**,
con marca en `prompt_id`. La segunda vez reporta y deja terminar, porque a esas
alturas al agente ya se le dijo y quien necesita ver la respuesta es una
persona. Probado ejecutando: rojo + prompt nuevo → `exit 2` con el diagnóstico y
su `fix`; mismo prompt otra vez → `exit 0`; prompt distinto → vuelve a bloquear.

**Y volví a nombrar un fichero que no existía.** `hooks.json` declaraba
`${CLAUDE_PLUGIN_ROOT}/scripts/gate-hook.js` y el generador no lo empaquetaba.
Un plugin se instala solo, sin el CLI que lo generó al lado, así que el script
tiene que viajar con él — se copia del compilado, no se reescribe, porque una
segunda copia de esa lógica es una segunda cosa que mantener correcta. Hay un
test que lo fija, y muerde: quitando el fichero, falla.

**Cero deriva por construcción:** los seis comandos salen de los mismos `STEPS`
que Cursor y Copilot, y un test compara la lista del plugin contra esa
definición.

`claude-plugin` es el único destino que `agents init` **no** escribe por
defecto: un plugin es un artefacto instalable, no algo que esparcir en cada
proyecto. El test de defectos ahora dice esa razón, no solo la lista.

---

### Lo que salió al hacer E1-04 *(2026-08-20)*

**E0-01 se pagó solo, y aquí está la factura.** Añadir `harness report` fue
**una fila** en `scripts/lib/surface.ts`: apareció sin tocar nada más en
`--help --all`, en la completion de shell, en el contrato de agente y en el
despachador. Era exactamente lo que E0-01 prometía y no se había puesto a
prueba hasta ahora.

**Y volví a meter H2, el defecto que el harness ya tuvo.** El registro se
escribe en el proyecto; el harness se niega a arrancar con el árbol sucio; así
que la primera ejecución hacía que la segunda se negara. Lo cacé ejecutando dos
veces seguidas, no leyendo.

El primer arreglo fue malo y conviene anotarlo: eximí `.harness/` del chequeo de
árbol limpio. Pasaba, pero **debilitaba el guarda** — y la suite lo dijo, porque
`tests/cli.test.ts` afirma *«the harness must leave the project tree clean»*.
Ese test es el guarda de H2 y tenía razón.

La solución correcta no toca ningún guarda: **el directorio se ignora a sí
mismo** (`.harness/runs/.gitignore` con `*`). El árbol queda limpio de verdad —
verificado con tres ejecuciones seguidas y `git status` vacío—, y los dos
parches anteriores se revirtieron.

**Qué se mide y qué no.** Reloj de pared, no tokens: un agente es un comando de
shell cualquiera y solo él sabe lo que gastó; registrar un número que el harness
no puede observar sería peor que no registrar ninguno. El comando del agente
**no** se guarda: es justo la clase de cadena que acaba llevando una API key.

`coste por requisito entregado` divide **todo** el tiempo —incluidos los
intentos fallidos— entre los requisitos que de verdad aterrizaron. Es lo que
cuesta entregar, no lo que cuesta acertar.

---

### Lo que salió al hacer E1-03 *(2026-08-20)*

Un requisito se corta ahora de **la rama de su dependencia**, no del HEAD de la
ejecución. Verificado con un control negativo, que es lo que hace que la
comprobación valga: el agente de REQ-002 aborta si no ve `src/a.js`. **Con** la
dependencia declarada pasa y `git merge-base --is-ancestor` confirma la
ascendencia; **sin** ella, falla. La derivación carga peso real.

El aviso de H9 sale con el número exacto: *«base stale-base is 1 commit(s)
behind main. A fix that landed on main is not in this worktree — a gate failure
may not be about REQ-001.»* Justo el diagnóstico que costó dos ejecuciones de
agente descubrir a mano.

**El hallazgo del día, y no es un caso raro sino uno garantizado.** Un requisito
con **dos** dependencias necesita el código de ambas, y sus ramas no se conocen
entre sí. Al integrarlas, el merge **siempre** choca en
`docs/specs/traceability.md`: cada ejecución termina llamando a `csda done`, que
edita la misma tabla. Es decir, **el harness se estorba a sí mismo** en cuanto el
grafo deja de ser una cadena.

La salida no fue rendirse ni fusionar a ciegas, sino ver para qué existe esa
base: **solo para que el agente vea código**. Su estado de matriz no lo consulta
nadie, y cada rama `harness/REQ-NNN` real conserva su propia fila intacta. Así
que un conflicto ahí es espurio y se resuelve quedándose con la versión de la
base; un conflicto en un fichero de código **de verdad** bloquea el requisito y
lo nombra. Ambos casos probados ejecutando.

Y no contradice «el harness nunca mergea»: esa promesa es sobre la rama que
revisa un humano. Esta base es desechable y se borra al terminar.

---

### Lo que salió al hacer E1-02 *(2026-08-20)*

**Medido, no supuesto:** dos requisitos independientes con un agente de 3 s
tardan 6,69 s en serie y **3,46 s con `--concurrency 2`** (193 % de CPU). Con la
dependencia declarada, los mismos dos requisitos vuelven a ejecutarse en serie
—correcto, porque uno espera al otro— y un fallo del predecesor deja al
sucesor en `blocked (0 attempts)`: **el agente no se invoca para trabajo que no
puede empezar**, que es H12 vista desde el bolsillo.

**El defecto que encontró esto, y que ya estaba:** `harness run --format json`
**violaba la regla 1 del contrato de agente**. Escribía las líneas de progreso
en stdout junto al documento JSON, así que
`harness run --format json 2>/dev/null | jq .` no parseaba. Y el contrato lista
ese comando. Nadie lo había notado porque **nada lo parseaba** hasta que el pool
de workers lo intentó. Arreglado: en modo JSON la prosa va a stderr.

**Decisión de diseño, con su motivo:** a `--concurrency 1` el bucle sigue siendo
el de siempre, en proceso y síncrono. Cada paso de un requisito —gate, agente,
`done`, git— es un `spawnSync`, y §12.11 es una lista de once defectos que solo
aparecieron ejecutando esto contra un agente real. Convertir todo eso a async
para que un requisito corra «en paralelo» con nada habría puesto el único camino
realmente ejercitado detrás de una reescritura sin probar. Por encima de 1, cada
requisito va a un proceso trabajador que **es** `harness run --req`, no una
versión reducida.

**Una carrera evitada a tiempo:** `git worktree prune` corría por requisito.
En serie es inofensivo; en paralelo puede borrar el registro de un worktree que
un hermano está creando en ese momento. Ahora se poda una sola vez, en el padre,
y los workers se saltan la poda (marca `CSDA_HARNESS_WORKER`).

**Hallazgo aparte, no arreglado aquí:** sin `test_cmd` configurado, el gate es
solo `validate --strict-tdd`, que no comprueba que los artefactos declarados
existan. Un agente que no escribe nada pasa el gate. Es de la familia de H1 y es
pre-existente. Merece su propia entrada.

**Pendiente consciente:** `csda req add --depends-on` sigue sin existir. No es
trivial como parecía: `req add` escribe solo la matriz y `depends=` vive en el
spec de capacidad, que puede no existir. Media implementación sería peor que
ninguna.

---

### Lo que salió al hacer E1-01 *(2026-08-20)*

**Q1 se resolvió sola con un hecho, no con una preferencia.** La opción de una
columna 11 en la matriz queda descartada porque es rotura: `RICH_HEADER` está
hardcodeado literal en cinco ficheros, y —lo grave— `done.ts` y `alm/core.ts`
leen el Status como **penúltima celda**. Con una columna más escribirían el
estado en la casilla equivocada, en silencio. E1-* es 1.1, la release que debe
probar G1; ahí no cabe una rotura de formato.

Así que gana la convención que el repo ya tiene: `<!-- specgate:trace ... depends=REQ-001 -->`.
El parser acepta claves arbitrarias, así que `depends=` salió gratis, y encaja
con el modelo que este repo aplica en todo lo demás — **el requisito declara, la
matriz refleja** (`change archive` ya lee ese comentario para escribir la fila).

Lo que cambia de verdad para quien lo usa:

- `plan` ordena la cola topológicamente y marca `⛔ blocked by REQ-NNN`.
- **Trabajo bloqueado deja de aparecer en `nextSteps`.** Antes `plan`
  recomendaba alegremente un requisito cuyo predecesor no estaba escrito, que es
  H12 vista desde el lado del usuario.
- `validate` falla con tres códigos nuevos, cada uno con `fix`:
  `requirement_cycle` (nombra el ciclo entero, `REQ-001 → REQ-002 → REQ-001`),
  `unknown_dependency` y `self_dependency`.

**Un defecto que casi se cuela:** escribí los diagnósticos con un alias local
`diagError(...)`, y el cosechador del contrato de agente busca `error(`. Los
tres códigos nuevos **no habrían entrado en el catálogo publicado** — presentes
en el código, ausentes del contrato. Se vio al comprobar `harvestCodes()` a
mano, no por un test. Vale la pena que `E1-04` o quien pase por ahí añada un
guarda: todo código emitido por `validate` debe aparecer en el contrato.

**La promesa de compatibilidad tiene su propio test:** un proyecto que no
declara nada recibe exactamente lo que recibía antes, en el mismo orden, con dos
arrays vacíos de más.

Pendiente y consciente: `csda req add --depends-on` todavía no existe, así que
hoy el `depends=` se escribe a mano en el spec de capacidad. Va con `E1-02`,
que es quien de verdad consume el grafo.

---

### Lo que salió al hacer E0-03 *(2026-08-20)* — **fase 0 cerrada**

El invariante que el ADR fija **ya era cierto en el código**: la única escritura
en `scripts/alm/` va a `.specops/alm-map.json`; `spec.md` y
`docs/specs/traceability.md` solo se leen. Escribir el ADR no cambió una línea
de comportamiento. Lo que cambió es que ahora hay algo que lo rompe si alguien
lo deshace.

Y esa es la parte que importa, porque con el puerto de E0-02 **añadir un
proveedor es una fila**: la regla que gobierna a Jira gobernará a YouTrack,
Linear y GitHub Issues. Escribirla antes del quinto proveedor es barato;
redescubrirla en cada uno, no.

Dos guardas, ambos mutados:

| Guarda | Mutación que lo prueba |
|---|---|
| Nada bajo `scripts/alm/` escribe en el árbol de specs | Meter un `writeFileSync` a `traceability.md` en el proveedor de Jira → falla |
| El estado no fluye del tablero al requisito | Hacer que `sync` marque `done` un requisito porque su issue está cerrado → falla |

**El coste, dicho sin rodeos** (está en el ADR y conviene que esté también
aquí): esta herramienta no permitirá nunca dirigir la entrega solo desde Jira.
Alguien tiene que escribir el criterio de aceptación. Un equipo que busque un
robot de tablero a código no es el comprador.

---

### Lo que salió al hacer E0-02 *(2026-08-20)*

Tres defectos, una sola causa: **nada declaraba qué claves de configuración lee
cada proveedor**, así que `readAlmConfig` validaba el mínimo común y el resto
pasaba sin que nadie lo mirara.

| # | Defecto | Cómo fallaba |
|---|---|---|
| A1 | Config de jira **sin `user_env`** pasa la validación | Revienta luego con `Environment variable JIRA_USER is not set` — una variable que el fichero nunca nombró |
| A2 | `alm.config.yaml` acepta **cualquier clave**, incluida `nonsense_key: 42` | Silencio. `harness.config.yaml` hace lo contrario en este mismo repo, y explica por qué: una clave que nadie lee es peor que una que falta, porque el fichero *parece* configurado |
| A3 | **`done_state` en jira no hace nada** | Solo lo lee azure. Jira descubre la transición del workflow, así que configurar un estado destino es letra muerta |

Ahora cada proveedor declara `config.required` / `config.optional`, y
`lintAlmConfig` avisa —con un `fix` y diciendo **qué proveedor sí habría leído
la clave**— antes de la primera petición de red.

**Dos decisiones deliberadas, para que no se relean como descuidos:**

1. **Avisos, no errores.** Rechazar de golpe rompería un pipeline que hoy
   funciona por una línea de más. E0-02 se declaró seguro pre-1.0 por ser
   refactor; endurecerlo a error es material de un major.
2. **`linkBack` queda fuera.** §3.2 lo dibuja en el puerto, pero escribir en el
   ALM es comportamiento nuevo, no extracción. Va con el proveedor `github` en
   `E1-06`. Y `capabilities` es un objeto declarado, no un método: una función
   que devuelve una constante es una constante.

**El kit de conformidad es lo que hace verdad "añadir un proveedor es una
fila".** Once comprobaciones por proveedor sobre respuestas grabadas en
`tests/fixtures/alm/<id>.json`, incluidas las que nadie escribe hasta que
duelen: barra final en `base_url` que no se duplique, respuesta fallida que se
propague, credencial ausente que nombre su variable. Mutado: un proveedor que
declara una capacidad que no tiene rompe 2 tests; uno registrado sin fixture
rompe 5.

**Un roce que conviene recordar:** documentar el puerto empujó
`docs/automation.md` por encima del gate de 300 líneas. El gate no se toca —la
sección se movió a `docs/alm.md`, que además es donde debía estar, porque el
formato de `alm.config.yaml` no estaba escrito en ninguna parte salvo dentro de
un mensaje de error.

---

### Lo que salió al hacer E0-01 *(2026-08-20)*

La superficie no estaba descrita en tres sitios, sino en **cinco**: el
despachador y `usage()` en `bin/`, las listas de la completion, la tabla del
contrato, los esquemas de MCP y las cadenas literales de
`scripts/agents/commands.ts`. `AI_RULES.md` ya exigía "ninguna orden nueva sin
fila en la tabla de despacho, en `usage()`, en la tabla del README y un test", y
aun así la deriva ya estaba publicada:

**Cuatro subcomandos existían y la completion no los ofrecía** — `harness init`,
`change instructions`, `alm link` y `alm status`. El guarda que debía impedirlo
comparaba solo nombres de primer nivel, raspando el despachador con una regex,
así que no podía ver un subcomando ni en principio.

Es exactamente el patrón de §12.11: el defecto no se ve leyendo el código, se ve
cuando algo lo ejecuta. Aquí lo ejecutó un test nuevo, no un agente, pero la
lección es la misma — **un guarda que no puede fallar no es un guarda.**

Tres notas de método que conviene repetir en `E0-02`:

1. **Línea base antes de refactorizar.** Se capturaron las 67 invocaciones de
   todos los comandos y subcomandos (código de salida + huella de stdout y
   stderr) antes de tocar el despachador, y se compararon después. Los códigos
   de salida salieron idénticos en las 67, y todo el delta de salida se redujo a
   tres cadenas intencionadas. Sin esa captura, "no cambia el comportamiento"
   habría sido una opinión.
2. **Los guardas se prueban mutando.** Apuntar una fila a una herramienta MCP
   inexistente rompe dos tests; declarar un comando que no enruta rompe un
   tercero. Comprobado, no supuesto.
3. **El registro no puede tragárselo todo.** `init`, `validate` y `harness
   prompt` siguen parseando por su cuenta porque cada uno es una decisión, no una
   ruta. Y dos campos —`argsFrom` y `order`— existen porque son comportamiento:
   `pack lint` y `config set` reciben su propio token de subcomando, y la ayuda
   diaria se lee como secuencia, no en orden de declaración.

Efecto lateral que sí es producto: `bin/create-spec-driven-app.ts` pierde 230
líneas y deja de ser un sitio donde se declara la superficie.

---

### Lo que salió al hacer E2-01 *(2026-08-20)*

**Antes de escribir la funcionalidad, la pregunta del usuario destapó dos
defectos que la dejaban sin base.** Se preguntaba si se puede *ver* qué ata un
agente a uno o varios REQ. Al medirlo ejecutando —tres REQ, un agente que
registra su pid, su worktree y los REQ que menciona su prompt— salió que:

1. **`--concurrency > 1` no hacía absolutamente nada.** El worker se lanza como
   `node <__filename> --req REQ-NNN`, y al mover el comando a
   `cli/commands/harness/RunCommand.ts` ese fichero pasó a ser el que *define*
   el comando, no el que lo *ejecuta*. Cada worker cargaba, no hacía nada y
   salía 0; el padre lo reportaba como «Worker produced no report» y marcaba
   fallado con 0 intentos. Ningún test recorría el camino paralelo de punta a
   punta.
2. **Cada worker escribía su propio registro de ejecución.** Una ejecución con
   `--concurrency 3` dejaba **cuatro** ficheros en `.harness/runs`. Como
   `harness report` lee el directorio entero, cada requisito se contaba dos
   veces: 12 intentos reportados sobre 9 reales, con filas duplicadas de
   duración idéntica. Eso corrompe justo las dos métricas de E1-04 — y §2.4
   hace de la fase C precondición de la fase B, así que la métrica rota
   bloqueaba lo que debía justificar.

**La respuesta a la pregunta, medida:** un agente está atado a **exactamente un
requisito**. Tres REQ con `--concurrency 3` dan tres pid distintos, en tres
worktrees distintos, y cada prompt nombra un único REQ. Con roles eso no cambia:
un intento puede invocar dos agentes (revisor y ejecutor), pero ambos sobre el
mismo REQ, el mismo worktree y la misma puerta. Lo que sí faltaba era poder
*verlo*: el registro ahora anota qué rol corrió cada intento, y la rama lleva un
prompt archivado por rol.

**El diseño falló primero por donde no se ve leyendo.** Construía el prompt una
vez por intento, así que los hallazgos del revisor llegaban al intento
*siguiente*, no al ejecutor que va detrás en el mismo intento — que es
literalmente para lo que existe el revisor. Se vio con un agente que reporta si
vio la sección: `sawFindings: false`. Ahora el prompt se construye por paso.

**Y descartar lo que toca el revisor casi se lleva la auditoría por delante.**
El descarte es `git clean -fd`, y el archivo de prompts es *untracked*: borraba
la evidencia de qué se le pidió a cada agente. Se excluye explícitamente. Las
dos protecciones están mutadas: si el revisor conserva sus ficheros, o si el
clean deja de excluir el archivo, el test falla.

**La regla dura se hace cumplir, no se confía.** El revisor del test escribe un
fichero a propósito. `advisory: true` es obligatorio en el perfil que nombra
`review_profile`, y sin él el harness se niega a arrancar.


---

### Lo que salió al hacer E1-06 *(2026-08-20)*

**«Añadir un proveedor es una fila» resultó ser cierto**, y esta es la factura a
favor: el conector son dos ficheros —`providers/github.ts` y su fixture— más una
fila en `PROVIDERS`. El kit de conformidad lo adoptó solo: once comprobaciones
sin escribir ninguna, y **la única que falló fue la de la tabla documentada**,
que exigió añadir `github` a `docs/alm.md` antes de dejar pasar el commit. Un
guarda que muerde en el primer uso real.

**Dónde GitHub se niega a parecerse a los otros dos, que es justo para lo que
existe el contrato de configuración:**

| | Jira / Azure | GitHub |
|---|---|---|
| Unidad | `project_key` | **`repo`** (`acme/widgets`) |
| `base_url` | obligatoria | **opcional** — solo Enterprise Server |
| Tipo | `issue_type` | no existe: hay etiquetas |
| Estado final | categoría / `done_state` | abierto o cerrado |

Escribir `project_key: acme/widgets` habría sido mentir, y el linter de config
ya avisa de esa clave como «la lee jira, azure — aquí no hace nada».

**El hallazgo de diseño: cerrado no siempre es hecho.** GitHub distingue cerrar
como `completed` de cerrar como `not_planned`. Colapsar ambos a `done` le diría
a `traceability.md` que un requisito se entregó cuando el equipo lo había
**descartado**. Así que `not_planned` se lee como abierto y la discrepancia sale
como deriva para que la resuelva una persona — que es literalmente lo que pide
ADR-0021. Simétricamente, `closeIssue` escribe `state_reason: completed`
explícito: sin él, las dos mitades del conector no coincidirían al releer.

Dos detalles que sin test se descubren contra un servidor real: un `repo` que no
sea `owner/name` se rechaza **antes** de la primera petición (si no, GitHub
responde un 404 que no dice nada del error real), y una issue cerrada **sin**
`state_reason` —las anteriores a que GitHub lo registrara— se lee como hecha;
tratarla como no-hecha reabriría años de historial en el primer `sync`.

**Un defecto colateral que github destapó:** la plantilla de «no encuentro
`alm.config.yaml`» estaba escrita a mano con forma de Jira e incluía
`project_key`, es decir, enseñaba a un usuario de GitHub exactamente la clave
que su propio linter le iba a reprochar. Ahora se genera desde las
declaraciones de cada proveedor, así que no puede enseñar una clave que nadie
lee.

**Lo que no entra, y por qué no a medias:** `linkBack` sigue fuera. La nota de
E0-02 lo aparcó aquí, pero §3.2 lo dibuja como `linkBack(issueKey, specUrl)` y
**nadie ha decidido de dónde sale ese `specUrl`**: el núcleo ALM no conoce el
remoto ni la rama, y derivarlo obligaría a meter git en una capa que hoy solo
habla HTTP. Media implementación sería peor que ninguna — la misma razón por la
que `req add --depends-on` sigue pendiente. Necesita decisión, no código.


---

### Lo que salió al hacer E1-07 *(2026-08-21)*

**Primero verificar, que era literalmente la tarea.** §4.4 decía que la primera
tarea era una hora de documentación, no código, y acertaba: los tres desenlaces
que planteaba no eran excluyentes. Antigravity **habla MCP y además tiene rutas
propias**, así que el desenlace real fue el 1 y el 3 a la vez — y salió barato
justo por lo que §4.5 predijo: el registro único ya existía.

Lo que dice su documentación, y que es lo único en lo que se apoya el código:

| | |
|---|---|
| Reglas del workspace | `.agents/rules/` — **plural**. Sigue aceptando `.agent/rules` en singular, y por eso el plural va escrito a propósito |
| MCP | `.agents/mcp_config.json`, descubierto por el IDE **y** por la CLI, con la misma forma `mcpServers` que usa Claude Code |
| Límite | **12.000 caracteres** por fichero de reglas |

**Lo que no se dio por bueno.** Varias guías de terceros afirman que Antigravity
lee `AGENTS.md`. Su documentación oficial **no lo menciona**, así que nada del
código depende de eso — si resulta cierto, es un extra, no un cimiento. Su
convención propia `GEMINI.md` ya la cubría la fila `gemini`.

**«Añadir una herramienta es una fila» volvió a ser cierto**, como en E1-06 con
el puerto ALM: una entrada en `TOOLS` y aparece en `--help`, en los defectos y
en el bucle de escritura sin tocar nada más.

**Una duplicación evitada a tiempo:** el objeto `mcpServers` estaba escrito
dentro del generador del plugin de Claude. Antigravity necesitaba el mismo, y
copiarlo habría creado dos definiciones del mismo servidor que se separarían en
cuanto una cambiara. Extraído a `mcpServerConfig()`, con un test que compara las
dos salidas.

**El límite de 12.000 tiene su propio test.** El fichero generado ronda los 700,
así que hoy sobra sitio — pero un fichero por encima del tope se trunca en
silencio, y un rulebook truncado es peor que ninguno porque parece completo.

---

### Lo que salió al hacer E2-02 *(2026-08-21)*

**El rol no cabía en el bucle del harness, y forzarlo habría sido el error.**
`harness run` gira alrededor de un requisito: un worktree por REQ, una rama con
su nombre, y una puerta de `validate --strict-tdd` más los tests del proyecto.
Un `change` **todavía no tiene requisito** —escribirlo es el trabajo—, así que
`spec-author` necesitaba su propio bucle, su propio alcance y su propia puerta:
`csda change validate`. Salió como `csda change author`.

**El prompt no se inventó.** `change instructions` ya sabía para qué sirve cada
artefacto, qué reglas debe cumplir, qué desbloquea y qué rango de REQ está
reservado. `change author` renderiza **esa misma** estructura para un agente en
vez de para una persona, así que no hay dos descripciones del mismo artefacto
que puedan separarse.

**El alcance se impone, no se pide.** Es la parte que justifica el rol: un
agente al que se le pide *describir* un cambio, y que puede editar el spec de
capacidad que describe, puede **hacer el cambio innecesario en lugar de
proponerlo** — en silencio, en un diff que parece el trabajo. Así que lo que
escriba fuera de `docs/specs/changes/<id>/` se deshace antes de que nadie lo
lea. El agente del test se sale a propósito.

**Y ahí metí un defecto destructivo, que es el hallazgo del día.** La primera
versión hacía `git checkout -- <ruta>` y **después** `rmSync` de la misma ruta:
restauraba el fichero y acto seguido lo borraba. Resultado medido:
`traceability.md` desapareció del proyecto. Habría borrado ficheros versionados
del usuario.

La causa fue tirar información: de `git status --porcelain` me quedé solo con la
ruta y descarté el código de estado, que es justo lo que distingue `??` (lo creó
el agente → borrar) de ` M` (ya existía → restaurar). Ahora se conserva el
código y cada caso se deshace como corresponde. El test lo fija y está mutado:
volviendo al borrado incondicional, falla.

**Exige árbol limpio**, como `harness run`. No es ceremonia: imponer el alcance
significa revertir lo que el agente escribió fuera, y en un árbol sucio eso no
se distingue de lo que tenías a medias. Con el árbol limpio, revertir solo puede
tocar el trabajo del propio agente.

**E0-01 vuelve a pagar:** una fila en `surface.ts` y `change author` apareció en
`--help`, en la completion, en el despachador y en el contrato de agente con sus
cinco códigos nuevos.

---

### Lo que salió al hacer E2-03 *(2026-08-21)*

**El hallazgo del día es que la promesa del ADR no era cierta todavía.**
ADR-0021 §4 dice que una issue entra como `change` con los escenarios
deliberadamente vacíos, y que el cambio pasa por `change validate` como
cualquier otro. Lo implementé, y al probarlo **`change validate` daba verde**
sobre un cambio con el escenario sin escribir.

Es decir: había construido justo la alternativa que el propio ADR-0021 rechaza
por escrito — *«fabrica filas que satisfacen `validate` sin describir
comportamiento, lo que convierte la puerta en una formalidad»*.

La causa no era mía: `- GIVEN <!-- la precondición -->` **es** Gherkin por
forma. El validador comprobaba que hubiera pasos y que alguno empezara por
GIVEN/WHEN/THEN, y eso lo cumplía. El hueco era anterior — un `- WHEN TODO`
escrito a mano también colaba. Ahora existe `scenario_steps_unwritten`: un
escenario cuyos pasos son solo palabra clave, comentario o `TODO` no asserta
nada y la puerta lo dice. Mutado por los dos lados: si la puerta deja de
rechazarlo, falla; si `pull` escribe pasos ya rellenos, falla.

**Dónde vive el comando, y por qué no en `scripts/alm/`.** El guarda de
ADR-0021 prohíbe *cualquier* escritura desde ese directorio, y un `pull` tiene
que producir ficheros. En vez de abrir una excepción en el guarda —debilitarlo
para que quepa lo nuevo— el flujo se parte por la misma línea que dibuja el ADR:
**el ALM lee el tablero** (`listIssues` en el puerto) y **el ciclo de `change`
escribe**. El guarda se queda intacto y el reparto es mejor de todos modos.

**El puerto necesitaba saber leer.** `createIssue`, `getIssueStatus` y
`closeIssue` direccionan una issue cuya clave ya tienes; buscar es otra cosa, y
es donde los proveedores dejan de parecerse: Jira usa JQL, GitHub parámetros de
consulta, Azure WIQL. Así que `listIssues` es una **capacidad declarada**:
`github` y `jira` la tienen, `azure` dice que no y `alm pull` degrada con un
mensaje que explica cómo hacerlo a mano. El compilador obligó a los tres a
pronunciarse al añadirla al tipo.

Dos detalles que salieron al implementar y que sin ejecutar no se ven: GitHub
devuelve los pull requests por el endpoint de issues —cada PR es una issue— así
que se filtran; y Jira Cloud devuelve `description` en Atlassian Document
Format, un árbol, no una cadena, así que se aplana y una forma desconocida da
`""` en vez de `[object Object]`.

**Idempotente a propósito:** un segundo `pull` salta los cambios que ya existen,
porque para entonces alguien puede haber empezado a editarlos. Hay test.

---

### Lo que salió al hacer E2-04 *(2026-08-21)*

**Lo primero fue leer bien la tarea.** El título dice «YouTrack, Linear, GitLab,
Jira DC», pero §3.3 no pide cuatro conectores: pide **el modelo de dos niveles**
que permite que existan sin vivir aquí. Implementar los cuatro habría sido
justo lo que el plan quiere evitar — atar la cadencia de este repositorio a
cuatro APIs ajenas. Lo entregado es el mecanismo; los cuatro son ejemplos de lo
que ahora puede escribir cualquiera.

`provider: npm:csda-alm-youtrack` se resuelve desde el `node_modules` **del
proyecto**, no del CLI, y el resto del árbol no se entera: `makeClient`,
`readAlmConfig` y `lintAlmConfig` siguen hablando con `AlmProvider`.

**Esto es una funcionalidad de seguridad, y conviene decirlo así.** Un fichero
de configuración commiteado puede provocar que se ejecute código de terceros —
y ese código recibe **el token del ALM**, porque un conector no puede hablar con
un tablero sin él. El modelo de confianza es el de una `devDependency`. Tres
guardas para que no sea *peor* que eso:

| Guarda | Por qué |
|---|---|
| **Nunca se instala solo** | Si instalara bajo demanda, editar un YAML pasaría a ser ejecutar código nuevo. Sigue siendo una decisión de dependencia, revisada |
| **Tiene que ser un nombre de paquete** | Sin esto, `npm:../../../etc/passwd` haría que un `require` cargue cualquier fichero del disco. Probado, y mutado |
| **Se valida contra el puerto antes de llamar a nada** | Un paquete que no es un proveedor —o que declara una capacidad que no tiene— falla con un diagnóstico que lo nombra, no con un stack trace a mitad de un `sync` |

Los dos últimos están mutados: quitando la comprobación del nombre, falla el
test de rutas; quitando la validación de la declaración, fallan dos.

**Lo que hizo barato todo esto fue E0-02.** `checkProviderDeclaration` ya
existía —se escribió para comprobar los proveedores del árbol— y resultó ser
exactamente la aduana que hacía falta para uno de fuera. No hubo que escribir
validación nueva.

**Verificado con un paquete real**, no con un mock: un `node_modules/csda-alm-youtrack`
completo, con su `package.json` y su `index.js`, resuelto desde el tarball
publicado.

---

### Lo que salió al hacer E2-05 *(2026-08-21)*

**La conclusión contradice la premisa de §3.1, y conviene que quede escrito.**
Aquella sección decía que un puerto ALM bien hecho convertiría el apaño
supra-repo en una capacidad declarada y sería «el único camino barato hacia P1
antes de v2». Con el puerto ya hecho: la primera mitad es cierta, la segunda no.
**El identificador era la parte fácil.** Lo caro de P1 —correlación de estados y
matriz federada— sigue igual de caro.

Y hay una razón de fondo para no tirar por ahí: el issue identifica *trabajo*, no
*requisitos*. Construir P1 sobre él sería hacer del tablero la fuente de verdad
del modelo de requisitos, que es exactamente lo que **ADR-0021 prohíbe**. El
apaño vale como apaño; deja de valer en cuanto se le pide definir qué es un
requisito.

**Lo que sí destapó medirlo: una parte de P1 ya funciona y nadie lo había
anotado.** `projects:` de `specops.config.yaml` acepta rutas relativas y no
comprueba que apunten dentro del repositorio, así que **`validate` ya recorre
repos hermanos**. Probado con dos repos git independientes: 2/2 passed. La pieza
que de verdad importaba —que CI pueda decir la verdad sobre N repos— estaba
hecha, escondida detrás de un mensaje que dice «🗂️ Monorepo».

**Y una inconsistencia real, que es la tarea barata que queda:** solo
`ValidateSpecsCommand` lee `projects:`. `plan` ve 1 requisito y `status` ve 0
sobre el mismo árbol donde `validate` recorre tres proyectos. Quien configura
`projects:` espera razonablemente que `status` cubra lo mismo. Sale como
`E2-06`, y no es cambio de modelo: cada proyecto sigue respondiendo por sí mismo
y el comando agrega, igual que `validate` ya hace.

**Algo que decidí no «arreglar»:** dos repos declarando ambos `REQ-001` validan
limpio, y **hacen bien**. Hoy la unidad es el proyecto y cada uno es su propio
espacio de nombres. Reportarlo como deriva habría sido inventar un defecto. Se
convierte en uno el día que exista vista federada — y ese día es el cambio de
modelo.

**Para cuando se aborde P1**, la revisión deja escrita la decisión que hay que
tomar antes de escribir código: de dónde sale el identificador supra-repo. La
opción que encaja con lo que este repositorio ya cree es que **el requisito lo
declare** —`<!-- specgate:trace implements=acme/billing#REQ-014 -->`— porque
`csda:trace` ya es el punto de extensión, ya acepta claves arbitrarias y ya lo
usa `depends=`. Merece ADR propio.

### 1.1 — la primera release que añade cosas (y por tanto la prueba real de G1)

| ID | Tarea | Idea |
|---|---|---|
| `E1-01` | `[x]` | Dependencias en el comentario `csda:trace`; `scripts/lib/requirement-graph.ts`; `plan` ordena y marca `blocked`; `validate` falla ciclos, dependencias inexistentes y autorreferencias — **cierra H12** | 1 |
| `E1-02` | `[x]` | `harness run --concurrency N` por niveles del DAG; descendientes de un fallo marcados `blocked` con 0 intentos, no fallados; ciclos reportados sin colgarse | 1 |
| `E1-03` | `[x]` | Base de worktree derivada del grafo (incluida integración de varias dependencias) + aviso de base obsoleta — **cierra H9** | 1 |
| `E1-04` | `[x]` | Registro `.harness/runs/<ts>.json` (autoignorado) y `csda harness report`: acierto al primer intento y coste por requisito entregado | 1 |
| `E1-05` | `[x]` | Plugin de Claude Code generado desde la misma definición: 6 comandos + MCP + hook `Stop` que bloquea con el gate en rojo, una vez por prompt | 3 |
| `E1-06` | `[x]` | Proveedor `github` (issues) sobre el puerto de `E0-02`: `repo` en vez de `project_key`, `base_url` opcional, y *cerrado no siempre es hecho* | 2 |
| `E1-07` | `[x]` | Antigravity: verificado contra su documentación — habla MCP **y** tiene rutas propias. Una fila en `TOOLS`: `.agents/rules/csda.md` + `.agents/mcp_config.json` | 3 |

### v2

| ID | | Tarea | Idea |
|---|---|---|---|
| `E2-01` | `[x]` | Roles como perfiles: `attempt_profiles` (escalera por intento) + `review_profile` asesor cuyo trabajo se descarta; un agente sigue atado a un solo REQ | 1 |
| `E2-02` | `[x]` | Rol `spec-author` como `csda change author`: alcance **impuesto** a `changes/<id>/`, puerta `change validate`, exige árbol limpio | 1 |
| `E2-03` | `[x]` | `csda alm pull`: un change por issue etiquetada, escenario vacío **y la puerta ahora lo rechaza** | 2 |
| `E2-04` | `[x]` | Modelo de dos niveles: `provider: npm:<paquete>` resuelto desde el `node_modules` del proyecto, validado contra el puerto y **nunca instalado solo** | 2 |
| `E2-05` | `[x]` | Revisado: el puerto **no** desbloquea P1 — el identificador era la parte fácil. Ver [p1-multirepo-revision.md](p1-multirepo-revision.md) | 2 |
| `E2-06` | `[ ]` | `plan`, `status` y `report` honran `projects:` como ya hace `validate` — sale de la revisión de E2-05, y no es cambio de modelo | 2 |

---

## 8. Lo que se dice que no, y por qué

Reunido aquí para que no haya que releer las tres secciones:

1. **Un runtime/SDK de agentes propio.** Mata la neutralidad de proveedor, que
   es lo que hace instalable esta herramienta en una empresa que ya eligió otro
   agente.
2. **Un juez LLM en la puerta.** Tenemos puerta determinista; cambiarla por una
   opinión es regalar la única ventaja estructural.
3. **Bus de mensajes entre agentes.** La pizarra es el repositorio, y su virtud
   es que CI puede verificarla.
4. **Webhooks / servicio alojado para el ALM.** El CLI es sin estado; la
   sincronización vive en CI.
5. **Bidireccionalidad plena con el ALM.** Dos fuentes de verdad, ninguna gana.
6. **Copilot Extension alojada.** Otro producto, otras credenciales, otro ciclo
   — el mismo razonamiento de D12.

---

## 9. Preguntas abiertas

Cosas que hay que decidir o verificar, no cosas que hay que programar.

| # | Pregunta | Quién decide |
|---|---|---|
| Q1 | ¿Dónde se declaran las dependencias entre requisitos: columna nueva en la matriz, o campo en el pack? La matriz es donde vive el estado; el pack es donde vive el modelo reutilizable. Probablemente el pack declara y la matriz refleja | Decisión de modelo — merece ADR |
| Q2 | ¿El paralelismo por defecto es 1 para siempre, o sube cuando el registro de ejecución demuestre que la tasa de acierto al primer intento se mantiene? | Datos de `E1-04` |
| Q3 | ~~Formato de extensión de Antigravity CLI~~ — **resuelto en E1-07**: habla MCP (`.agents/mcp_config.json`) y tiene reglas propias (`.agents/rules/`) | Cerrada |
| Q4 | ¿El plugin de Claude Code se publica en un marketplace propio o se instala desde el repositorio? Afecta a credenciales y ciclo de release, igual que D9/D12 | Decisión de distribución |
| Q5 | ¿`alm pull` genera un `change` por issue, o uno por lote? Uno por issue es más limpio de revisar; uno por lote es más realista con un backlog de cincuenta tickets | Se decide con un piloto real, no en abstracto |

---

## 10. La lectura de conjunto

Las tres ideas son buenas y las tres apuntan en la misma dirección, que es la
correcta: convertir una herramienta que valida specs en el plano de control de
la entrega. Ninguna exige reescribir nada, y las tres tienen ya media
implementación en el árbol.

El orden importa más que las ideas. En concreto:

- **La idea 3 va primero**, aunque suene la menos ambiciosa, porque el registro
  único abarata las otras dos.
- **La idea 2 es la que más valor comercial da por euro**, porque el puerto ya
  existe de hecho y porque Jira es la puerta de entrada a la empresa.
- **La idea 1 es la más vistosa y la que más fácil sale mal.** Su fase A (grafo
  y paralelismo) es sólida y cierra dos defectos abiertos. Su fase B (roles)
  solo debe hacerse cuando la fase C pueda demostrar que sale a cuenta.

Y una advertencia que vale para las tres, y que este repositorio ya aprendió por
las malas en §12.11: **nada de esto se valida leyéndolo.** Una sola ejecución
real del harness destapó tres defectos que ninguna revisión estática habría
encontrado. Multiplicar agentes, conectores y hosts multiplica también esa clase
de defecto. La regla de aquella sección sigue siendo la regla de esta:
se ejecuta contra un caso real, o no cuenta.
