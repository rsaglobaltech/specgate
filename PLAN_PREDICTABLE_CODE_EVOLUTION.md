# De la puerta al verificador — qué le falta a Specgate para comprobar el código, y no solo el papeleo

> **Reescrito el 2026-08-25.** La versión anterior de este fichero comparaba Specgate con
> [Predictable Code](https://code.predictablemachines.com) sobre una tabla de 21
> huecos. Nueve de esos huecos no los reclama nadie: eran ideas nuestras con etiqueta
> de «vamos por detrás». Y la columna de lo que Specgate ya tiene también inflaba. Esta
> versión mantiene el hallazgo real —que es uno y es grande— y tira el resto.

---

## 1. Método, y qué no se hizo

| | |
|---|---|
| **Qué se leyó del rival** | Su página pública, `code.predictablemachines.com`, el 2026-08-25. Nada más |
| **Qué NO se hizo** | Nadie de aquí ha usado Predictable Code. Está en *private beta*: no hay CLI que ejecutar, ni lenguajes publicados, ni precio |
| **Qué se midió de Specgate** | El árbol de este repositorio en `main`, v0.7.0. Cada afirmación de §3 lleva `fichero:línea` |

**Regla para mantener este documento:** toda fila de §2 lleva **cita textual** de la
página del rival; toda fila de §3 lleva **`fichero:línea`** de este repo. No hay
tercera categoría. Una afirmación sin una de las dos cosas se borra, no se matiza.

Esa regla es la que faltaba, y es la causa de los tres defectos de la versión
anterior.

---

## 2. Lo que el rival reclama — verificado

Seis capacidades. Textual:

| # | Capacidad | Cita |
|---|---|---|
| PC-1 | Verificación formal | *«Predictable Code uses Lean 4 formal verification to prove that AI-generated code matches your specifications.»* |
| PC-2 | Proofs matemáticas continuas | *«Every change is checked against your specs in real time, producing mathematical proofs of correctness.»* |
| PC-3 | Proofs criptográficas de auditoría | *«Cryptographically verifiable proofs connect requirements → implementation → verification.»* |
| PC-4 | Inferencia de specs | *«Run predictable init, then predictable specs infer. The tool reads your source tree and generates formal behavioral specifications.»* |
| PC-5 | Status check nativo de GitHub | *«Every pull request is automatically checked against your specs as a native GitHub status check.»* |
| PC-6 | Plugin de Claude Code | *«Verify specs without leaving your coding flow. The plugin lets Claude run verification as part of your conversation.»* |

**Estado del producto:** private beta · public beta Q2 2026 · GA Q3 2026. Gratis para
participantes aceptados; precio sin anunciar. **Lenguajes soportados: no se
especifican.**

**No reclama** —y la versión anterior se lo atribuía— reportes de compliance
SOC 2 / HIPAA / PCI-DSS, counterexamples concretos, modo YOLO de reparación
automática, un visor local `specs/_viewer.html`, Z3/SMT, watch mode, plugin de Codex
CLI, 3-way resolution paths ni análisis AST multi-lenguaje con tree-sitter. Nueve
huecos de veintiuno. Ver §7: no se tiran, se reetiquetan.

---

## 3. Lo que Specgate tiene — medido, no recordado

Solo las filas donde la versión anterior se pasaba de frenada. El resto de su tabla
—packs, change lifecycle, ALM sync, harness, multi-CI, arquitectura hexagonal— es
correcto.

| Capacidad | Lo que decía | Lo que es | Evidencia |
|---|---|---|---|
| Mutation testing | ✅ | Piloto sobre **dos** ficheros, `testRunner: "command"`, `coverageAnalysis: "off"`, `thresholds.break: 0`. Es una línea base registrada, **no una puerta** | `stryker.config.mjs:32-33` |
| Property-based testing | ✅ fast-check para invariants | **Un** fichero de test | `tests/unit/property-based.test.ts:12` |
| HTML Report / Studio | «`specgate report` + `specgate studio` live dashboard» | `report` **escribe** un HTML autocontenido en `reports/`. `studio` es un **servidor HTTP** (puerto 4173) que no escribe nada, renderiza en memoria y **carga Mermaid desde `cdn.jsdelivr.net`** | `ReportCommand.ts:148,398` · `StudioCommand.ts:135,170-179` |
| MCP Server | «`read_spec`, `list_requirements`, `validate_project`, etc.» | Siete tools exactos: `read_spec`, `list_requirements`, `update_traceability`, `lint_pack`, `validate_project`, `plan`, `mark_requirement_done`. JSON-RPC escrito a mano, sin el SDK de MCP | `packages/mcp-spec-driven/src/tools.ts:382-390` · `server.ts:10-19` |
| LSP Server | «Diagnostics para traceability y pack.yaml» | Cuatro códigos —`STATUS`, `DUP-SCN`, `TDD-1`, `TDD-2`— **solo** sobre `traceability.md` en formato rich; se rinde si falta la cabecera. Sin diagnósticos de Gherkin, sin completions, sin hover, sin code actions | `packages/lsp-spec-driven/src/diagnostics.ts:81,103-131` |
| `specgate validate` | «Quality Gates» | `--strict-tdd` = **tres** reglas, todas sobre la matriz. `--strict-scenarios` = ocho reglas de Gherkin. `--against-lock` **requiere red** (re-resuelve packs remotos) y degrada a aviso con matriz legacy | `ValidateProjectUseCase.ts:126,133,144` · `GherkinQuality.ts:70-78` · `CheckAgainstLockUseCase.ts:36,43` |
| Zero runtime dependencies | ✅ | Cierto, y **estructural**: el `package.json` raíz no tiene siquiera la clave `dependencies`. `YamlLite.ts` está escrito a mano por eso. Matiz: los paquetes MCP y VS Code, que se publican aparte, sí traen `js-yaml`/`ajv` | `package.json` · `packages/core/src/domain/YamlLite.ts` |

**El agujero air-gapped que ya existe:** `studio` pide Mermaid a un CDN. El argumento
de «procesamiento local» de la §8.2 anterior tiene un roto antes de que llegue
ninguna dependencia nueva.

---

## 4. El hueco real, y es uno

> **`specgate validate` comprueba que el papeleo es coherente consigo mismo. No comprueba
> que el código haga lo que la spec dice.**

Ese es el techo del producto, y la versión anterior lo nombró bien (era su hueco 3).
Los huecos 1, 4 y 9 —inferencia, verificación continua, detección de divergencias— son
ese mismo hueco visto desde otro lado. La evidencia, medida:

| Hecho | Evidencia |
|---|---|
| `--strict-tdd` son tres reglas, y las tres leen la **matriz**: artefacto de test en `TBD` con estado post-Draft; fila rich sin Scenario ID con estado no-Draft; `REQ-\d+` en `spec.md` sin fila | `ValidateProjectUseCase.ts:126,133,144` |
| **No existe ningún parser de código fuente en el repo.** Cero apariciones de tree-sitter, `ts.createSourceFile`, babel, acorn, esprima, swc u oxc en `bin/`, `scripts/`, `packages/`, `templates/`, `schemas/` | grep repo-wide |
| `specgate onboard` propone capabilities a partir de **nombres de directorio y conteo de ficheros**. Nunca abre uno | `OnboardCommand.ts:111` (`countFiles`, cuenta y no lee) · `:141` (`proposeCapabilities`) |
| `specgate adopt` solo lee manifiestos de build (`pom.xml`, `build.gradle`, `package.json`) y por regex | `AdoptCommand.ts:76-123` |
| `specgate fix` arregla exactamente dos cosas, **añadiendo filas a `traceability.md`**: features huérfanos y REQ-ids sin fila. No toca código, ni features, ni estados | `FixCommand.ts:47-72,188` |
| `DeclaredArtifacts` compara declaraciones de la matriz contra el diff de git — comprueba que un fichero **se tocó**, no qué dice | `DeclaredArtifacts.ts:49,65,85` |

Todo lo demás de este documento sirve a cerrar esa frase, o sobra.

---

## 5. Lo que NO copiamos

Sección calcada de `mejoras/openspec-benchmark-plan.md` §7. Su ausencia en la versión
anterior es precisamente por qué allí todo era un hueco a cerrar.

| Del rival | Por qué no |
|---|---|
| El vocabulario **«mathematical proof» / «cryptographically verifiable»** (PC-2, PC-3) | Es la trampa H13 con un auditor delante. Toda la serie H de `plan-cierre-enterprise.md` §12.11 es **un** defecto repetido —*la puerta aprueba sin comprobar*—; H1 quedó descrito como «la negación del producto» y H19 **sigue abierto**. Un SHA-256 sobre un check estructural es el hash de una heurística. Sellarla y llamarla proof es la versión de mayor apuesta del defecto que este repo lleva un mes cazándose a sí mismo |
| **Reportes de compliance SOC 2 / HIPAA / PCI-DSS** | El rival no los reclama; eran nuestros. Y ADR-0020 ya costó la lección: declaró el JSON Schema «única autoridad» sin que nadie lo aplicara, y diez de once packs lo fallaban mientras los once pasaban `pack lint --strict`. Se cerró rebajando la afirmación al hecho (`E1`, opción B). Firmar un informe HIPAA sobre verificación estructural es el mismo error con consecuencias legales |
| **Lean 4** (PC-1) | No hay ruta desde aquí. Se nombra como horizonte en §8, nunca como fase con fecha |
| **La inferencia con LLM como puerta de entrada** (PC-4, tal cual) | ADR-0014 ya decidió lo contrario para `pack infer`: *«Heuristic, not LLM, for v1. Deterministic output is testable, reviewable in a git diff, works offline, has no vendor dependency, and is instant.»* Si se revierte, se revierte con un ADR que lo enmiende — no de tapadillo dentro de una fase |
| **Un visor nuevo** | ADR-0019 decidió el 2026-08-16 que `specgate studio` **es** la superficie de studio, y cerró —no aplazó— la Fase 4 de `visual-pack-authoring-todo.md`. Lo que falta de P2 son ~6 líneas de workflow para publicarlo, no una UI nueva |

---

## 6. Decisiones ya tomadas que la versión anterior pisaba

Cada una tiene dos salidas legítimas: **respetarla**, o **enmendarla con un ADR
nuevo**. Ninguna admite ignorarla en silencio, que es lo que hacía el documento.

| Decisión | Qué decía | Contra qué chocaba | Salida |
|---|---|---|---|
| **ADR-0014** (2026-05-14) | `pack infer` es heurístico y determinista; `--llm` diferido explícitamente | Fase 1.2 «AI-Assisted Spec Enrichment» | Respetar en v1. La inferencia arranca determinista; el LLM, si llega, entra por ADR |
| **ADR-0019** (2026-08-16) | `specgate studio` es *la* superficie de studio | Hueco 18 «Local Spec Viewer» y Fase 3.3 | Respetar. Lo que se construya se construye **dentro** de `studio` |
| **ADR-0022** (2026-08-21) | *«Los patrones son opcionales; los principios no.»* Y: prosa que ninguna máquina verifica igual la obedece todo agente | Fase 1.2 y Fase 2.2, ambas capas de LLM cuyo veredicto nadie comprueba | Respetar. Un resultado no determinista no puede marcarse `verified` |
| **ADR-0020 + `E1`** (2026-08-23) | El esquema describe el formato que existe; nada afirma autoridad que no ejerce | Fase 4 entera (proofs, sellado, compliance) | Respetar. Es la regla que §5 aplica |
| **§13 del plan de cierre** | Watch mode aparcado, con motivo | Hueco 12 y Fase 2.5 | Sigue aparcado hasta que haya algo que observar |
| **D9 / D12** (2026-08-17) | Publicar plugins, extensión, scope npm y registry va a **v2** | Fase 5 (GitHub App) y Fase 6 (plugin de Codex) | v2. Una GitHub App es un canal de distribución con credenciales propias — exactamente lo que D12 movió |

---

## 7. Nuestras ideas, no las suyas

Los nueve huecos que el rival no reclama. No se tiran: dejan de ser «ponerse al día» y
pasan a ser propuesta propia, que es lo que siempre fueron. Se priorizan por lo que
rinden, no por quién los tenga.

| Idea | Valor | Nota honesta |
|---|---|---|
| **Counterexamples concretos** — cuando una comprobación falla, devolver el input exacto que la rompe | **Alto en teoría.** Es la diferencia entre «diverge» y una reproducción | **Recosteado el 2026-08-26 — no es barato, y la nota original se equivocó.** Ver `Z3 / SMT` abajo: pertenece a esa fila, no a esta |
| ~~**Tres rutas ante una divergencia**~~ — arreglar código / actualizar spec / retirar el requisito | **Ruta 2 hecha el 2026-08-26 — ver §11.** Rutas 1 y 3 no necesitaban herramienta nueva | Era pegamento entre piezas que ya estaban, no motor nuevo |
| **Watch mode** | Bajo hoy | Aparcado por §13. Observar una puerta que no comprueba lo que dice no aporta |
| **Modo YOLO de reparación automática** | Bajo | El harness ya es el bucle desatendido, con presupuesto (`C1`) y worktrees. Esto sería un segundo bucle peor |
| **Compliance SOC 2 / HIPAA / PCI-DSS** | Cero por ahora | Ver §5. Vuelve a la mesa cuando haya algo real que certificar |
| **Z3 / SMT** · **tree-sitter multi-lenguaje** · **`specs/_viewer.html`** · **plugin de Codex** | — | Ver §5 y §6 |

### Por qué «counterexamples concretos» no era barato — medido el 2026-08-26

La nota original decía: *"sin solver hay que generarlos, y `fast-check` (ya en
devDeps) hace justo eso. Ruta barata inexplorada."* Antes de construir nada
se comprobó dónde usa este repo `fast-check` de verdad —
`tests/unit/property-based.test.ts` — y resulta que genera counterexamples
para **funciones de este propio repo**, importadas y llamadas en el mismo
proceso donde el test ya corre (`renderTemplate` de `PackSpec.ts`, requerida
directamente). Es barato **porque la función ya vive en el mismo runtime**,
no porque `fast-check` resuelva el problema general.

Un counterexample real de "tu código viola tu spec" —lo que Predictable Code
vende— exige **ejecutar el código del usuario**: importar su función,
generarle inputs, encontrar el que rompe una propiedad. Medido contra lo que
esta sesión ya construyó, eso no es una extensión, es otra categoría:

- Rompe la propiedad que sostuvo `specgate:trace`/`specgate:value` toda la sesión —
  funcionan igual en cualquier lenguaje porque **nunca ejecutan nada**, solo
  leen texto. Ejecutar código solo es posible en el único runtime que el CLI
  ya tiene, JS/TS — deja de ser agnóstico al lenguaje.
- Necesita cargar y llamar módulos del proyecto del usuario desde el CLI:
  superficie de confianza nueva, no comparable a leer un fichero.
- Necesita un contrato de anotación nuevo (qué función probar, qué propiedad
  cumplir) — no una extensión de `specgate:trace`, un formato distinto.

**Decisión: aparcado, no descartado.** Pertenece a la fila de Z3/SMT/Lean 4 —
horizonte a costear y decidir con diseño explícito cuando llegue el momento,
no algo que se cuela como "barato" porque una dependencia de test ya estaba
instalada. Es la misma disciplina que corrigió `--strict-links` (incondicional
→ opt-in) y `--strict-values` (gate → reporte): medir antes de construir, y
corregir la nota anterior en vez de heredarla.

---

## 8. Por dónde se empieza

> **Premisa fijada el 2026-08-25:** verificación primero, 1.0 después. Ver `D14` en
> `mejoras/plan-cierre-enterprise.md` §14, donde consta también lo que cuesta.

### 8.1 · El orden va al revés de como estaba

La versión anterior construía el verificador y confiaba en que las specs contuvieran
algo verificable. No lo contienen. Su propio ejemplo lo demuestra: el bloque «Formal
Contract» que proponía son viñetas en prosa, y `- Max 5 failed attempts per hour per
user` no es comprobable por ninguna máquina tal como está escrito. Es exactamente la
prosa que ADR-0022 señala.

**Primero que la spec declare valores comprobables; después comprobarlos.** Eso ya
está en el backlog y cuesta «Bajo»: es `F6` (EARS opcional en la línea de requisito),
en `mejoras/valoracion-bdd-gherkin-era-agentes.md`. Sin ese paso, cualquier
verificador se queda en comparar nombres de fichero.

### 8.2 · La matriz no admite una columna más

La Fase 0.1 anterior pedía añadir `linked_files`, `proof_hash` y `last_verified` como
columnas. **No se puede**, y no es opinión:

- `TraceabilityFormat.ts:38` reconoce una fila rich por `cells.length === 10`.
- La nota de `:92-107` documenta que una columna 11 rompe el parser.
- **Y por eso** `depends=` y `context=` ya viajan fuera de la tabla, en líneas
  `<!-- specgate:trace REQ-002 depends=… context=… -->`, con parser propio en `:108-198`.

El punto de extensión existe, está probado y lo usan `B1` y `D1`. Todo campo nuevo va
ahí. Coste de intentar lo otro, para que quede escrito: parser, serializador, el
driver de merge por filas del harness en paralelo
(`mejoras/colisiones-traceability-paralelo.md`), `change archive`,
`tests/unit/docs-truth.test.ts`, los once packs y todo proyecto ya generado.

### 8.3 · Hay dos gramáticas de `spec.md`, y el plan no decía a cuál iba

| Gramática | Dónde | Cómo se lee |
|---|---|---|
| **Capability spec** (`docs/specs/capabilities/<cap>/spec.md`) | `packages/core/src/domain/SpecParser.ts` | Parser real, orientado a líneas. Prefijos de etiqueta **cerrados** (`REQ, SCN, UC, CMD, QRY, AGG, EVT`, `:56`), y propiedad de punto fijo parse→render→parse (`:426`) |
| **`spec.md` raíz** (manifiesto, `## REQ-NNN — Título`) | Ninguno | Raspado por regex en **cinco** sitios: `ValidateProjectUseCase.ts:140`, `alm/core.ts:163`, `mcp/tools.ts:119`, `DoctorCommand.ts:155`, `FixCommand.ts:130` |

Un «contrato formal» en el raíz nace en cinco regex que ya divergen. En el de
capabilities, toca un parser con invariante de punto fijo y un conjunto cerrado de
prefijos. **Decisión: el contrato formal vive en el capability spec**, que es el único
que tiene gramática, y se expresa como campos del `specgate:trace` que ese parser ya lee
(`parseTraceComment`, `SpecParser.ts:96`) antes que como secciones nuevas.

### 8.4 · Las dependencias hay que costearlas, no listarlas en riesgos

La versión anterior despachaba esto con «optional peer dependencies, graceful
degradation». Es la primera dependencia de runtime de la historia del proyecto:

- **tree-sitter** son bindings nativos N-API, y **una gramática compilada por
  lenguaje**.
- **z3-solver** son megas de WASM.
- Contra un `package.json` **sin clave `dependencies`**, que sostiene `npx`, el
  argumento air-gapped y la procedencia SLSA.

**El precedente del repo es explícito y va en contra.** Cuando hizo falta un parser de
Gherkin, se escribió a mano (`packages/core/src/domain/Gherkin.ts`, con la tabla de
dialectos vendorizada como datos) y `@cucumber/gherkin` quedó como **oráculo de test**
contra la deriva, en devDependencies. tree-sitter no admite ese trato: no se escribe a
mano un parser de Java.

O sea que esto es una bifurcación de la historia de distribución, y se decide como
tal —con ADR— no dentro de una fase.

### 8.5 · Lo que sí se puede hacer sin nada de lo anterior

Dos comprobaciones se nombraron aquí. La primera está hecha; la segunda sigue sin
diseñar.

**Hecha (2026-08-25): el vínculo declarado sigue apuntando a algo que existe.**
`specgate validate --strict-links` lee las columnas Feature file / Technical artifact /
Test artifact de la matriz y falla si una ruta declarada ya no existe en disco.
Reutiliza `declaredPaths`/`looksLikePath`, ya escritos para `DeclaredArtifacts`
(A2) — ninguna dependencia nueva, nada de AST.

**Corrección medida, no supuesta.** La primera versión la hizo incondicional, con
el razonamiento de que "esta ruta no existe" no tiene lectura legítima.
`tests/unit/validate-strict-tdd.test.ts` lo desmintió de inmediato: una fila en
`Draft` o `In Dev` declara con normalidad el fichero donde un requisito **va a**
aterrizar, antes de que exista — planear no es deriva documental. Es la misma
razón por la que `declared_artifact_untouched` en `DeclaredArtifacts` ya es un
warning, no una certeza. Se corrigió a opt-in, misma promesa que
`--strict-scenarios`.

Ninguna de las dos es verificación formal y ninguna debe llamarse así. Es la
puerta comprobando una cosa más de las que hoy da por buenas — el patrón de la
Tanda 1, la que cerró H14, H15 y H16.

### 8.6 · Mitad 2 de §8.5 — hecho el 2026-08-26

> **Estado: implementado.** `packages/core/src/domain/ValueAnnotations.ts`
> (dominio, puro, 12 tests) + `buildDeclaredValues` en
> `scripts/cli/commands/quality/ReportCommand.ts` (I/O, 12 tests). Sin flag
> nuevo en `validate` — `specgate report` gana la sección, `--record` gana tres
> campos aditivos en el historial, `sparkline()` gana una segunda serie
> punteada cuando todo el historial la tiene. Medido contra este propio repo:
> con cero anotaciones, `declaredValues` es todo cero y la sección no
> aparece — igual que `orphanFeatures` cuando no hay huérfanos.
> `tests/unit/architecture.test.ts` sigue en verde sin tocarlo, por
> construcción — la restricción explícita de quien pidió esto.

**El problema, en el ejemplo que la propia página del rival usa:** *"session
timeout is 30m but spec requires 15m"*. Ninguna comprobación de este documento
lo detecta — `--strict-requirements` valida la forma de la frase, no lo que
dice; `--strict-links` valida que el fichero exista, no lo que contiene. Falta
comparar un valor declarado en la spec contra el mismo valor declarado en el
código, sin AST y sin pretender entender ninguno de los dos.

**Corrección de alcance, la misma sesión.** La primera versión de este diseño
proponía `--strict-values` como gate binario, calcado de `--strict-requirements`
y `--strict-links`. Objeción correcta: valor-por-valor con gate duro no escala
con el tamaño del proyecto, por dos razones distintas.

1. **El coste de anotar crece con el número de hechos comprobables, la
   cobertura no.** Cada hecho exige escribir la pareja de anotaciones a mano.
   Un proyecto grande acumula cientos de pares; cuantos más, más probable que
   alguien actualice un lado y olvide el otro — que el check detecta, pero solo
   para lo que alguien llegó a anotar en ambos lados primero.
2. **Cuanto más complejo el sistema, menor la fracción de requisitos que son un
   valor escalar.** Un timeout o un límite de reintentos se presta a esto; una
   regla de negocio con ramas (*"10% de descuento si el pedido supera $100, 5%
   en el resto"*) no es un valor, y la igualdad literal no la toca. La cobertura
   real de este mecanismo se encoge, en términos relativos, según crece la
   complejidad de lo que el proyecto declara.

**La corrección no es rediseñar la anotación — es rediseñar la entrega.** El
par de anotaciones explícitas se queda igual que en la versión anterior de este
diseño: sigue siendo la única forma honesta de comparar un valor sin AST y sin
heurística de nombres. Lo que cambia es que deja de ser un gate que falla el
commit y pasa a ser una sección de `specgate report` — un mapa de deriva agregado,
no un veredicto binario por valor. Un proyecto grande con cobertura parcial de
anotaciones ve su mapa parcial y prioriza; no falla en bloque por no haberlo
anotado todo. Es el mismo principio que ya rige `report`: `needsTest` y
`orphanFeatures` son listas para atender, no gates.

**Esto es, además, la vía real para competir de tú a tú en esto.**
Predictable Code vende *"proof en tiempo real"* — una afirmación sin evidencia
externa, en beta privada, sin dato de cómo se comporta a escala. Un mapa de
deriva agregado con tendencia en el tiempo, sobre algo que ya construimos
(`report --record`, el historial JSONL, el sparkline), es una promesa que sí
podemos sostener y que además encaja con lo que Specgate ya es — multi-proyecto,
packs, auditoría como markdown legible, no como teatro criptográfico. No
igualamos su frase; ofrecemos una honesta y verificable en su lugar.

**Restricción cumplida: `tests/unit/architecture.test.ts` no se tocó.** Sus
cuatro reglas siguen en verde — la tabla de abajo explica dónde vive cada
pieza y por qué, y es la razón de que no hiciera falta tocarlas.

#### La decisión: anotación explícita a ambos lados, comparada por igualdad literal

Ni AST ni heurística de nombres. Dos anotaciones, mismo identificador, texto
literal comparado por igualdad — el mismo trato que `specgate:trace` ya da a
`depends=` y `context=`: explícito, determinista, y la herramienta no
interpreta nada, solo compara lo que un humano (o un agente) ya escribió dos
veces a propósito.

**Lado spec — dentro del `specgate:trace` que el requisito ya lleva:**

```markdown
### Requirement: REQ-AUTH-002 — Token expiry

El sistema SHALL expirar el token de sesión a los 15 minutos de inactividad.

<!-- specgate:trace uc=Login value_session_timeout=15m -->
```

Sin campo nuevo en el parser: `parseTraceComment` (`SpecParser.ts:96`) ya acepta
cualquier clave `[a-z_]+`. La convención es solo de nombrado — toda clave con
el prefijo `value_` declara un valor comprobable; lo que sigue al prefijo
(`session_timeout`) es el identificador que ambos lados comparten.

**Lado código — un marcador de una línea, en el lenguaje que sea:**

```ts
// specgate:value session_timeout=15m
const SESSION_TIMEOUT = "15m";
```

No es un comentario reconocido por lenguaje — es una cadena literal buscada en
el texto del fichero, igual que `specgate:trace` es una cadena literal buscada en
markdown. Funciona idéntico en `.ts`, `.py`, `.java`, `.go` sin saber nada de
ninguno, porque no analiza sintaxis: solo busca la frase `specgate:value clave=valor`
en cualquier línea. Esto es lo que de verdad resuelve la pregunta multi-lenguaje
que el documento original creía necesitar tree-sitter para responder — el precio
es que alguien tiene que escribirlo, dos veces, a propósito.

**Qué ficheros se escanean — reutilizando el enlace que ya existe.** Nada de
campo nuevo para nombrar el fichero: se escanean los mismos `Technical
artifact` / `Test artifact` que `--strict-links` ya valida que existen para
ese requisito, correlacionando `req.id` (capability spec) con `row.requirement`
(matriz) — la misma correlación por id que `--strict-requirements` no necesitó
pero que aquí sí hace falta, porque el valor vive en el código, no en la spec.

**Comparación: igualdad de cadena exacta, nada más.** `15m` contra `15m` pasa;
`15m` contra `900000` falla, aunque ambos signifiquen lo mismo. Interpretar
unidades es el trabajo que este documento entero existe para no reclamar
(§5, la trampa H13) — normalizar la unidad es responsabilidad de quien escribe
las dos anotaciones, no de la herramienta.

#### Dónde vive cada pieza — por qué no rompe `architecture.test.ts`

| Pieza | Capa | Fichero (nuevo o existente) | Por qué esa capa |
|---|---|---|---|
| Extraer `value_*` de un `TraceComment` ya parseado | Dominio, puro | `packages/core/src/domain/ValueAnnotations.ts` (nuevo) — función `declaredSpecValues(trace)` | Recibe un objeto ya en memoria, no toca disco |
| Parsear `specgate:value clave=valor` de un texto de código | Dominio, puro | mismo fichero — función `declaredCodeValues(source: string)` | Recibe una cadena ya en memoria — la misma disciplina que `Gherkin.ts` o `GherkinQuality.ts` con el texto de un `.feature` |
| Comparar ambos mapas y producir el modelo de comparación (no un `Diagnostic[]` — ver superficie, abajo) | Dominio, puro | mismo fichero — función `compareDeclaredValues(specValues, codeValues, opts)` | Solo estructuras de datos entrando y saliendo; sin `fs`, sin `path` |
| Leer el capability spec, la matriz y los ficheros de código; llamar a las tres funciones de arriba; agregar al modelo del reporte; opcionalmente anexar al historial | Comando (I/O) | `scripts/cli/commands/quality/ReportCommand.ts`, dentro de `buildReport()` (`:10`, el modelo que devuelve empieza en `:29`) | Es donde ya vive toda la agregación de `report` — `readSpecops` (`:44`) es el mismo patrón: leer del disco, devolver un bloque del modelo |

Ninguna pieza nueva importa desde `scripts/` hacia `packages/core/src` en la
dirección prohibida, ninguna hace I/O dentro de `domain/`, y `application/`
no se toca — no hace falta un nuevo caso de uso, el patrón de comando+dominio
que ya usan `--strict-requirements` y `--strict-links` alcanza. Las cuatro
reglas de `tests/unit/architecture.test.ts` quedan intactas por construcción,
no por vigilancia.

#### Superficie — reporte, no gate

**Sin flag nuevo en `validate`.** Nada falla el commit por esto. `specgate report`
agrega una sección nueva al modelo que ya devuelve `buildReport()`
(`ReportCommand.ts:29`):

```ts
declaredValues: {
  total: number,       // pares con el mismo identificador en ambos lados
  matched: number,
  diverging: number,
  specOnly: number,    // declarado en la spec, sin specgate:value en el código
  codeOnly: number,    // specgate:value en el código, sin value_ en ningún requisito
  items: Array<{
    id: string, requirement: string,
    specValue: string, specFile: string, specLine: number,
    codeValue: string | null, codeFile: string | null, codeLine: number | null,
    status: "matched" | "diverging" | "spec_only" | "code_only",
  }>,
}
```

- **`specOnly` y `codeOnly` no son error, son inventario.** Un identificador
  anotado en un solo lado no es una promesa incumplida, es cobertura parcial —
  exactamente lo que un mapa de deriva tiene que poder mostrar sin fallar nada.
- **HTML**: una tabla junto a las de `needsTest`/`orphanFeatures` ya existentes
  en el reporte (mismo `esc()` de `:103`, mismo estilo de fila).
- **Tendencia en el tiempo, reutilizando `--record`.** `appendHistory`
  (`ReportCommand.ts:91`) hoy escribe `{ts, total, implemented,
  implementedPct}` por ejecución en `reports/spec-coverage-history.jsonl`.
  Se le añaden tres campos — `valuesTotal`, `valuesMatched`,
  `valuesDiverging` — de forma aditiva: una línea de historial vieja sin esos
  campos se sigue leyendo, `readHistory` (`:73`) ya descarta líneas que no
  parseen sin perder el resto. `sparkline()` (`:120`) gana una segunda serie
  con el mismo mecanismo que ya traza `implementedPct`.
- **`specgate doctor` como advisory, sin gate — extensión natural, no parte de
  este diseño.** Igual que `--strict-scenarios` también aparece en `doctor`
  como aviso (`DoctorCommand.ts`), un `diverging` podría listarse ahí. Se deja
  como costura abierta, no como trabajo de esta fase.

#### Lo que esto no hace, dicho para que no se olvide

No verifica que el código *en efecto* respete el valor en tiempo de ejecución —
solo que la anotación del código coincida con la de la spec. Un `SESSION_TIMEOUT
= "15m"` correctamente anotado y después ignorado por el código real seguiría
apareciendo como `matched`. Es detección de deriva entre dos declaraciones
explícitas, no verificación de comportamiento — el techo que §5 fija a
propósito, sin moverlo por cambiar de gate a reporte.

**Tampoco bloquea nada, y es a propósito — no un downgrade.** La versión
gate habría podido fallar un commit por una anotación de menos en un proyecto
grande, que es precisamente el escenario que motivó la corrección. Depende de
adopción: nadie escribe `specgate:value` por scaffolding automático todavía, así
que el siguiente paso real es anotar un requisito de verdad — de este propio
repo o de `specgate-studio-app` (§3.5 de `mejoras/README.md`) — y ver la sección
aparecer con datos reales, no sintéticos. Los 24 tests nuevos (12 dominio + 12
comando) cubren la lógica; ninguno sustituye a esa primera anotación real,
la misma disciplina que ya midió y corrigió `--strict-links`.

---

## 9. Cómo se mide el éxito

Fuera toda métrica que compare contra una capacidad no observada del rival. Quedan
tres, y las tres se miden en este repo:

| Métrica | Hoy | Objetivo |
|---|---|---|
| Comprobaciones de `validate` que leen algo distinto del papeleo | **0** | ≥ 1, determinista y sin dependencias de runtime |
| Requisitos cuya spec declara un valor comprobable (`F6`) | 0 | Medible, y es el prerrequisito de la anterior |
| Afirmaciones de este documento sin cita ni `fichero:línea` | 0 | 0 |

---

## 10. Riesgo principal

No es técnico. Es que la palabra «verificación» crezca más rápido que lo que la puerta
comprueba de verdad. Ese fallo tiene nombre propio en este repo —H1, H13, H15, H16,
H19— y todos aparecieron **ejecutando**, ninguno leyendo.

Así que la regla de §1 no es papeleo: es la misma disciplina aplicada al documento que
propone el trabajo.

---

## 11. Tres rutas ante una divergencia — ruta 2 hecha el 2026-08-26

§8.6 detecta que un valor diverge; no hacía nada con ese hallazgo. §7 nombraba
tres rutas de resolución (arreglar código / actualizar spec / retirar el
requisito) como «alto valor, barato» porque `specgate change` y
`ArchiveChangeUseCase` ya existen. Medido antes de construir nada: **dos de
las tres rutas no necesitaban herramienta nueva.**

- **Ruta 1 — arreglar el código.** `specgate report` ya da `codeFile:codeLine`
  para cada `diverging` (§8.6). Abrir el fichero y arreglarlo no necesita un
  comando nuevo.
- **Ruta 3 — retirar el requisito.** Ya es `specgate change new <id> --capability
  <cap>` con una sección `## REMOVED Requirements` escrita a mano — el
  mecanismo de retiro no distingue por qué se retira un requisito.
- **Ruta 2 — actualizar la spec.** Esta sí es pegamento real: encontrar el
  requisito, encontrar el valor del código, escribir el delta. **Hecha.**

### `specgate change new <id> --from-value-drift REQ-ID:value_id`

```bash
$ specgate change new fix-timeout --from-value-drift REQ-200:session_timeout
  ✔ Change fix-timeout created (lite · REQ ids REQ-201…REQ-203 reserved)
    + docs/specs/changes/fix-timeout/specs/auth/spec.md
```

Genera un delta `## MODIFIED Requirements` con la requirement **completa**
copiada tal cual (`renderRequirement`, ya existente en `SpecParser.ts:439`,
la reutiliza sin reescribirla) — MODIFIED reemplaza el nodo entero
(`DeltaSpec.ts` `apply`), así que hace falta el requisito completo, no un
fragmento. Dos cambios sobre la copia:

1. **`value_<id>` en el `specgate:trace` se reescribe al valor del código.** Es un
   campo estructurado — reescribirlo es exacto, no una interpretación.
2. **La prosa NO se reescribe.** «expira a los 15 minutos» no se convierte en
   «a los 30» automáticamente — eso sería adivinar cómo debería sonar la
   frase en nombre de un humano. Se añade un `TODO:` explícito en su lugar,
   la misma contención que `pack infer` ya usa para lo que no puede inferir
   (ADR-0014).

**Ficheros a escanear, de nuevo sin campo nuevo:** se reutiliza el mismo
Technical/Test artifact que `--strict-links` y §8.6 ya leen — vía
`readCapabilityRequirements`, extraído a `scripts/lib/capability-specs.ts`
porque `report` y `change` ya lo necesitaban ambos (la lección F1/A3: un solo
lector, no dos que puedan divergir).

**Cuatro salidas limpias, sin dejar un directorio de cambio a medias:**
`value_drift_requirement_not_found`, `value_drift_id_not_declared`,
`value_drift_no_code_value`, `value_drift_already_matches` — esta última
existe a propósito: si el valor ya coincide, no hay nada que proponer, y
crear un cambio vacío sería peor que negarse.

**Medido, no solo probado con fixtures:** generado, pasado por `specgate change
validate` de verdad, y comprobado que el delta resultante lo acepta el
parser real (`parseDelta`), no solo que el texto «se parece» a uno válido.
14 tests nuevos (5 dominio puro + 9 wiring de CLI).
