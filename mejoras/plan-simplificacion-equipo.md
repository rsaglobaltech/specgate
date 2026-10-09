# Plan: que un equipo lo adopte sin manual

**Abierto:** 2026-10-06 · **Origen:** feedback del equipo («difícil de usar y de
asimilar») · **Relación:** continúa [plan-feedback-adopcion](plan-feedback-adopcion.md)
(que arregló *si el verde significa algo*). Este plan ataca *cuánto cuesta
llegar a ese verde*.

> El plan anterior mide con agentes en frío. Este se mide con **personas del
> equipo**. Un agente no se cansa de leer 61 páginas de documentación; una
> persona sí.

---

## 1. Valoración frente al mercado SDD

Mercado revisado (octubre de 2026): GitHub Spec Kit (v1.1, ~140k ★), OpenSpec
(~71k ★), Kiro (AWS), BMAD (~54k ★), GSD, Agent OS v3, Tessl, y el plan mode de
Cursor y Claude Code. Marco de referencia: los niveles de Böckeler/Fowler
(*spec-first · spec-anchored · spec-as-source*).

### Dónde está Specgate

**Spec-anchored con puerta determinista.** Es el único de la lista que
comprueba en CI, sin LLM, que cada requisito tiene escenario, test y fila. El
resto verifica con un LLM (`/opsx:verify`, la persona QA de BMAD) o no verifica
nada (Spec Kit, Agent OS, Cursor). **Ese es el hueco de mercado más claro y es
nuestro.** Hay que protegerlo, no diluirlo.

### Comparativa

| Dimensión | Specgate (0.8.1 / develop) | Lo que hacen los más adoptados |
|---|---|---|
| Dónde vive el flujo | CLI con 38 comandos; el agente es secundario (`agents init`) | **Dentro del agente**: 4–6 slash commands; el CLI solo hace `init`/`update` |
| Núcleo que hay que aprender | ~10 conceptos: REQ, SCN, UC, Command/Query, Aggregate, Event, change, pack, lock, harness… | OpenSpec: 4 verbos (`explore/propose/apply/archive`). Spec Kit: 6 |
| Unidad de trabajo | Fila de una matriz de 10 columnas + sección en `spec.md` + `.feature` | Una carpeta por cambio (`changes/<id>/`) que se revisa en el PR y se archiva |
| Formato de requisito | Prosa libre + Gherkin en `.feature` aparte | SHALL + WHEN/THEN (OpenSpec) o EARS (Kiro), **en el mismo fichero** |
| Trazabilidad | Matriz Markdown guardada y mantenida (con merge driver propio para sus conflictos) | Nadie la guarda; OpenFastTrace la **genera** desde tags |
| Escala al tamaño del cambio | Un único flujo | Quick Spec (Kiro), Quick Flow (BMAD), perfil core/expandido (OpenSpec) |
| Nombre | `specgate`, `csda`, `create-spec-driven-app`, `/csda:*`, `merge=csda-matrix` | Uno |
| Documentación | 61 páginas (~9,9k líneas), 28 ADRs, libro, `mejoras/` en el repo del producto | README + una página de flujo |
| Verificación código↔spec | **Determinista** (estructura, enlaces, cobertura nombrada, `done --test-cmd`) | LLM o nada |
| Brownfield | `adopt` no invasivo, honesto («certifica el esqueleto») | Agent OS / OpenSpec: descubrir del código, deltas |

### Diagnóstico

El producto **no es difícil por estar mal hecho**; las rondas de adopción lo
han endurecido mucho. Es difícil por cuatro decisiones de forma:

1. **El flujo vive en el CLI y no en el agente.** El desarrollador tiene que
   aprender comandos, banderas e ids, y luego explicárselos al agente. El
   mercado hizo lo contrario: el agente conoce el flujo y el CLI es la puerta.
2. **La matriz es un artefacto que se mantiene, no un informe que se genera.**
   De ahí salen `req add/link/rm`, el merge driver, la corrupción H22, las
   colisiones en paralelo y buena parte de los 38 ficheros que la tocan.
   [sustituir-traceability-md](sustituir-traceability-md.md) ya midió que es
   casi enteramente derivable.
3. **Vocabulario DDD obligatorio en la ruta común.** Aggregate, Event, UC y
   Command/Query son columnas para todos, aunque el equipo no haga DDD táctico.
   Y el Gherkin es obligatorio aunque el repo no tenga Cucumber.
4. **Superficie antes que núcleo.** Packs, specops, ALM, harness, MCP, LSP,
   VS Code, Maven/Gradle, studio y libro crecieron mientras el bucle básico
   todavía corrompía la matriz. Cada uno añade nombres a aprender.

## 2. Estado de las ramas (medido 2026-10-06)

| Qué | Estado | Acción |
|---|---|---|
| 13 ramas de feature (#164–#178) | Mergeadas por squash a `develop` | Borrar en remoto y en local |
| `docs/round-2-setup` (#175) | Cerrada sin mergear; su contenido entró por #176 | Borrar |
| `fix/round-3-orbit` (#179) | Abierta → `develop`, 1 commit | Revisar y mergear |
| `develop` | **16 commits por delante de `main`**, sin release desde 0.8.1 (2026-09-04) | Release 0.9.0: los arreglos de las rondas 1–2b no los tiene ningún usuario |
| Dependabot | 6 PRs abiertos (#145, #147, #182–#185) | Agrupar y mergear o cerrar |

**Contradicciones vivas en `develop`**, encontradas al recorrer el bucle sobre
un repo de prueba:

- `templates/adopt/spec.md.tpl:5` dice que `req add` «does not write a section
  here»; desde la fase 3 sí la escribe.
- `specgate req link --help` imprime la ayuda de `req`, no la de `link`.
- `specgate --help --all` describe `validate` con `--strict-tdd / --strict-scenarios / …`
  y su ejemplo usa `--strict-tdd`: la «puerta única» de la ronda 2 no llegó a la ayuda.
- `docs/tutorial.md` cita `--strict-tdd` 14 veces y `docs/automation.md` 9.
- `agents init` genera `/csda:*` en un producto llamado Specgate.

---

## 3. Plan

Ordenado por **cuánto baja el coste de entrada para una persona**, no por
interés técnico. Cada fase se publica sola y no rompe a los usuarios
existentes (regla de ADR-0026: la minor avisa y la siguiente exige).

### Fase 0 — Higiene y release (1–2 días)

- [x] Mergear #179, resolver dependabot, borrar las 14 ramas cerradas — **hecho 2026-10-06** (#179, #147, #183–#185, #191; #145 descartado: TS 7; dependabot apunta a `develop` desde #187).
- [x] Corregir las contradicciones de arriba, con un test que ate cada texto
      de ayuda o plantilla al comportamiento — **hecho 2026-10-06**, rama
      `fix/fase-0-higiene`:
  - `req add|link|rm|done --help` dan su propia ayuda (antes repetían la del padre).
  - La plantilla `spec.md` de `adopt` dice lo que `req add` hace hoy.
  - `--help --all`, el ejemplo de la CLI, la descripción MCP, `status`, `fix`,
    `change`, las instrucciones a agentes, README, 7 páginas de `docs/` y 2
    plantillas recomiendan `--strict`, no `--strict-tdd`.
  - **El rename `/csda:*` → `/specgate:*` pasa a la fase 1**: renombrar
    ficheros generados exige que `specgate update` migre las instalaciones
    existentes sin perder ediciones, y eso no es higiene.
- [x] **Hallazgo nuevo — el harness y el hook del agente usan una puerta más
      débil que la CI.** — **hecho 2026-10-06**, rama `fix/harness-strict-gate`.
      Al cambiarlo apareció un defecto mayor: `--strict-links` exigía los
      ficheros de **toda** fila, también las `Draft`, así que con `--strict`
      como puerta de CI cualquier equipo que declara rutas antes de escribirlas
      tenía el build en rojo. Ahora solo las filas entregadas deben sus
      ficheros, y `done --check` y el harness usan `--delivering REQ` para
      comprobar el requisito que cierran antes de que cambie su estado. `harness run` y el `Stop` hook ejecutan
      `validate --strict-tdd`; la CI generada ejecuta `--strict`. El harness
      puede declarar verde un requisito cuyo `src/…` declarado no existe. Probado:
      pasarlos a `--strict` rompe 5 tests del harness cuyos fixtures declaran
      ficheros que el agente falso nunca crea — que es exactamente el caso.
      Cambio de comportamiento: PR propio, con los fixtures corregidos.
- [x] Release **0.9.0** `develop → main` — **hecho 2026-10-06**, publicada en npm, GitHub Packages y Docker. Sin esto, todo el feedback del equipo
      es sobre una versión con H22–H24 ya arreglados en el código.

### Fase 1 — Un nombre y un núcleo de cinco verbos (1 semana)

**Avance:**
- [x] `specgate check` — **hecho 2026-10-06**, rama `feat/check-command`. Sustituye a
      `validate` en la ayuda diaria. De paso: `req link --status` se ignoraba en
      silencio; ahora se rechaza y remite a `done`.
- [x] `specgate new` — **hecho 2026-10-06**, rama `feat/new-command`. Hueco encontrado al
      diseñarlo: un escenario de pasos plantilla pasaba todas las puertas con el
      requisito `Implemented`. Ahora es `scenario_placeholder_step`, exigido al
      entregar; `done --strict` pasa a ser la puerta completa.
- [x] `status` absorbe `plan` — **hecho 2026-10-06**, rama `feat/status-absorbs-plan`. `Next` nombra el requisito; `plan` sale de la ayuda diaria.
- [x] `init` absorbe `adopt` y `onboard` — **hecho 2026-10-06**, rama `feat/init-adopts`. Solo el camino sin banderas cambia; los scripts con `--yes`/`--config`/`--out` siguen igual.
- [x] `--help` de cinco verbos — **hecho 2026-10-06**, rama `feat/daily-help-five`: `init` +
      `status`, `new`, `req`, `check`, `done`. `req` sigue hasta la fase 3 (cuando `req link`
      desaparezca). **Sin avisos de deprecación**: los comandos viejos no se retiran, solo
      salen de la ayuda corta; avisar en cada uso a quien los tiene en scripts sería ruido.
- [x] `/csda:*` → `/specgate:*` con migración en `update` — **hecho 2026-10-06**, rama
      `feat/specgate-agent-names`. Encontrado de paso: `update` adoptaba el `README.md` del
      proyecto como el del plugin (la siguiente ejecución lo habría corrompido), y el plugin
      comiteado llevaba parado desde 0.6.0 ejecutando `npx csda … --strict-tdd`.

**Objetivo:** que `specgate --help` quepa en una pantalla y no haya nada más que
aprender para el 80 % del equipo.

| Verbo | Sustituye a | Hace |
|---|---|---|
| `specgate init` | `init`, `adopt`, `onboard` | Detecta si el repo tiene código: si sí, adopta y propone capacidades; si no, scaffold |
| `specgate new "<título>"` | `req add` + editar `spec.md` + crear `.feature` | Requisito con su escenario WHEN/THEN en un solo sitio |
| `specgate check` | `validate --strict` + `done --check --test-cmd` | **La** puerta: estructura, enlaces, cobertura y suite. Lo que corre en CI |
| `specgate status` | `status`, `plan` | Dónde estás y el siguiente comando |
| `specgate done REQ-NNN` | `done`, `req done` | Cierra tras `check` |

- [ ] Los comandos actuales siguen funcionando como alias con aviso de
      deprecación (0.9) y se ocultan del `--help` por defecto.
- [ ] Packs, specops, harness, ALM, MCP, studio y report pasan a
      `specgate --help --all` bajo «Extensiones».
- [ ] **Un solo nombre:** `/specgate:*`, `merge=specgate-matrix`, `doctor` y
      plantillas. `csda` se queda como alias binario silencioso.
- [ ] `validate` conserva sus banderas individuales para CI existente, pero
      ninguna página las enseña.

### Fase 2 — El agente es la interfaz (1–2 semanas)

**Hecho 2026-10-07**, rama `feat/agent-daily-loop`: los comandos del agente son
el flujo diario — `/specgate:explore` (status), `new`, `apply`, `verify`
(check), `done` — más `propose`/`archive` para lo ya entregado y `onboard`
(init). Se conservan los nombres existentes para no dejar ficheros huérfanos
en quien actualice. Las reglas enseñan que nombrar `REQ-NNN` en un test o en
el código **es** el enlace. El hook `Stop` regenera la matriz antes de juzgar.
No se hizo: fusionar `AI_RULES.md` en `AGENTS.md` (cambio de formato que
merece su propia decisión).

**Objetivo:** el desarrollador habla con su agente; el CLI es lo que el agente y
la CI ejecutan.

- [x] `specgate init` instala por defecto **skills/slash commands** en el agente
      detectado (no los 10 a la vez) — **hecho 2026-10-09**, rama
      `feat/init-agent-default`: detecta por marcas (`.claude/`, `CLAUDE.md`,
      `.cursor/`, `GEMINI.md`…), instala los `/specgate:*` solo para esos, nunca
      sobrescribe; sin agente, dice cómo; `--no-agents` lo salta.
- [x] Un solo `AGENTS.md` corto (≤ 60 líneas) como contrato. `AI_RULES.md` se
      funde en él — **hecho 2026-10-09** (ADR-0031, rama `feat/agents-md`):
      bloque marcado, `update` migra, backend/frontend 36 líneas, móvil 41.
- [ ] Hook opcional (Claude Code / Kiro / git pre-push) que corre
      `specgate check` al terminar: la verificación determinista enganchada a un
      evento real (principio 12 del mercado, donde somos fuertes).

### Fase 3 — La matriz se genera, no se mantiene (2–3 semanas)

**Avance:**
- [x] **3A** — derivación, `specgate matrix` (`--check`, `--migrate` con verificación de ida
      y vuelta), `matrix_stale` en `validate`, `check` regenera — **hecho 2026-10-06**, rama
      `feat/derived-matrix`. Decisión: el fichero **sigue en disco como salida generada**,
      porque ~20 lectores lo abren directamente (mapa medido); cambia el dueño, no el formato.
- [x] **3B** — en modo derivado `done`/`req link`/`req add` escriben en `spec.md`;
      `new`/`req rm`/`change archive` regeneran; `status`/`plan`/`check` leen fresco; capability
      specs derivadas; `fix`/`expand`/MCP no pisan la matriz — **hecho 2026-10-06**, rama
      `feat/derived-writers`. **Límite conocido:** un pack escribe `spec.md` y la matriz con
      sus propias plantillas, así que `expand` devuelve el proyecto a matriz manual y lo avisa
      (decidido en 3C tras romper los escenarios BDD de `expand`).
- [x] **3C** — matriz generada por defecto en `init`/`adopt` (`--keep-matrix` para salir);
      `req` fuera de la ayuda corta, que queda en **cinco verbos**; `new`/`status` dejan de
      recomendar `req link` — **hecho 2026-10-06**, rama `feat/derived-by-default`. Encontrado
      al probar el flujo: `done --check` y el harness validaban antes de regenerar, y rechazaban
      el test que acababa de escribirse. El merge driver se queda: en un proyecto derivado, un
      conflicto en la matriz se resuelve con `specgate matrix`.

**Objetivo:** eliminar la causa de H22, del merge driver y de `req link`.

- [ ] Fuente de verdad: el requisito en `spec.md` (o en specs de capacidad) y
      **tags en tests** (`@REQ-012`, `// REQ-012`, nombre de test) que
      `--strict-coverage` ya sabe leer.
- [ ] `traceability.md` pasa a ser **salida** de `specgate status --matrix` /
      `report`, no fichero comiteado. El modelo `csda:trace` → `traceRow()` ya
      existe; deja de guardarse el resultado.
- [ ] `specgate migrate` convierte una matriz existente en tags/anotaciones y la
      retira. La 0.9 lee ambos formatos.
- [ ] Desaparecen para el usuario: `req link`, el merge driver y la mitad de
      `req`.

### Fase 4 — Perfil simple por defecto (1 semana)

**Descartada por ahora, 2026-10-07 (decisión del usuario).** Con la matriz
generada (fase 3) nadie la edita y las columnas DDD sin usar salen como `-`;
unos 20 lectores esperan la cabecera de 10 columnas. Mucho riesgo para poco
beneficio. Se reabre si el piloto se queja del vocabulario DDD.

- [ ] Columnas por defecto: **Requisito · Escenario · Test · Estado**. Use Case,
      Command/Query, Aggregate y Event sólo con `profile: ddd`
      ([arquitectura-opcional-perfiles](arquitectura-opcional-perfiles.md) ya lo
      diseñó).
- [ ] Escenarios WHEN/THEN **dentro de `spec.md`** por defecto. `.feature`
      Gherkin sólo si el repo tiene Cucumber/behave/SpecFlow, o con `--gherkin`.

### Fase 5 — El proceso se ajusta al tamaño del cambio (3–4 días)

**Descartada 2026-10-07, tras medir:** la puerta que genera `ci init` es
`validate --strict` y **no exige un requisito nuevo por PR** — un bugfix sin
requisito ya pasa hoy. `Spec: none` resolvería un problema que no existe. Si el
piloto muestra que alguien *cree* que lo exige, es un problema de
documentación, no de herramienta.

Respuesta directa a la crítica «waterfall» que reciben todas las herramientas SDD.

- [ ] Un bugfix o refactor **no necesita requisito nuevo**: `check` pasa si el
      PR no toca specs ni añade comportamiento (etiqueta o trailer
      `Spec: none`, visible en la revisión).
- [ ] `change` (deltas sobre specs ya entregadas) queda para cuando cambia un
      comportamiento contratado, no para todo.

### Fase 6 — Documentación de una página (3–4 días)

**Hecho en `docs/`, 2026-10-07**, rama `docs/phase-6-one-way`: `getting-started`
entra por `init` y enseña los cinco verbos; `quickstart`, `writing-specs`,
`tutorial` y `comparisons` dejan de enseñar `onboard`/`adopt`/`req link`/`plan`
como camino principal. **`mejoras/` y `book/` se quedan en el repo**
(decisión del usuario).

- [ ] `docs/` se reduce a: **Quickstart (10 min)**, Flujo diario, La puerta en
      CI, Brownfield, Referencia, Extensiones. Resto, a «Avanzado».
- [ ] `mejoras/`, `book/`, `BOOK_PLAN.md`, `GEMINI_BOOK_PROMPT.md` y
      `PLAN_PREDICTABLE_CODE_EVOLUTION.md` salen del repositorio del producto (a
      un repo de notas o a `docs/internal/` excluido de la web). Un recién
      llegado que abre el repo no debe ver 10k líneas de diario de diseño.
- [x] Guía «primer PR con Specgate en tu equipo»: rol del revisor, qué mirar
      en el diff de la spec, qué hacer cuando `check` falla — **hecho
      2026-10-07**, [`docs/first-pr.md`](../docs/first-pr.md). Escribirla con
      salidas reales destapó tres tropiezos del primer día, arreglados: `done`
      marcaba ✔ lo que `check` rechazaba después (ahora pasa la puerta antes de
      escribir); `ci init`, el paso 4 que recomienda `init`, fallaba sin
      `--provider` (ahora lo detecta); los `fix:` de TDD y las reglas de
      `change apply` hablaban de la matriz a mano.

### Fase 7 — Congelar superficie

- [ ] Ninguna extensión nueva hasta que se cumpla la medida de abajo.
- [ ] Packs, specops, ALM, LSP, VS Code, Maven/Gradle, studio y harness se
      etiquetan *experimental* en la web; las que nadie del equipo use en el
      piloto se candidatan a otro repo.

---

### E2E del paquete instalado — **hecho 2026-10-06**

`e2e/run.mjs` empaqueta, instala el tarball en un directorio vacío y recorre
12 recorridos reales contra el binario instalado. Workflow `E2E` en cada PR,
en Linux, macOS y Windows; `publish-npm.yml` solo publica si pasa. Lo que
encontró antes de publicar: el harness y `plan` seguían recomendando
`req link` en proyectos con matriz generada, y el código no se enlazaba por
mención como los tests — ahora sí, y `req link` sale del flujo diario.

### E2E de todas las funcionalidades — en curso desde 2026-10-07

Petición del usuario: probar todas las funcionalidades de punta a punta.

- [x] **Paso 1** — `e2e/` dividido por áreas (`e2e/journeys/*.mjs`, núcleo en
      `e2e/lib.mjs`), en paralelo; cada recorrido declara qué comandos
      `covers`. `node e2e/run.mjs --coverage` compara con la superficie y con
      `e2e/uncovered.json`, que **solo puede encoger**; lo ejecutan un test
      unitario y el workflow. Punto de partida: **14/60 comandos (23 %)**.
- [x] Paso 2 — utilidades: `doctor`, `fix`, `plan`, `report`, `req done/rm/list`,
      `config *`, `schema *`, `completion *`, `studio`, `onboard`, y un recorrido
      que pide `--help` a **todos** los comandos. **34/60 (57 %).** Encontró que
      11 comandos fallaban al pedirles ayuda (los grupos `ci`, `pack`, `specops`,
      `harness`, `config`, `agents`, `alm`, `mcp`, más `expand`, `harness prompt`
      y `mcp install`): arreglados.
- [x] Paso 3 — packs y specops sin red: repo git local con tags `v0.1.0`/`v0.2.0`
      (`specops add/diff/sync/remove`, `pack bundle` para air-gap, `pack
      init/lint/infer`, `expand`). **43/60 (72 %).** Encontró que **un pack recién
      instalado ponía la CI en rojo**: un requisito sin escenario no llegaba a la
      matriz y `--against-lock` fallaba; el `sync` que sugería no lo arreglaba.
      `specops contribute` pasa al paso 4 (necesita un `change`).
- [x] Paso 4 — ciclo `change` completo (de `new` a `archive` y entregado con `done`),
      `change author` (revierte lo que el agente escribe fuera del cambio),
      `harness init/prompt/run/report`, `specops contribute`. **55/60 (92 %).**
      Encontró: (1) `change archive` no materializaba el `.feature` del delta —
      el ciclo documentado dejaba la matriz apuntando a un fichero inexistente;
      (2) un requisito archivado no se podía cerrar con `done` en matriz
      generada, y no se enlazaba por mención. Ambos arreglados.
- [x] Paso 5 — ALM contra un Jira falso en su propio proceso (`alm sync/link/
      status/pull`: crea, cierra al entregar, detecta deriva, trae peticiones
      como cambios); MCP de punta a punta (`mcp install` con un `HOME` de usar y
      tirar, y el servidor que esa config arranca, por stdio). **61/61 (100 %).**
      Encontró que **el MCP nunca funcionó**: `mcp install`, `agents init` y el
      plugin de Claude apuntaban a `@specgate/mcp-server`, que no está publicado.
      Ahora el servidor va dentro del paquete (`specgate mcp serve`). El LSP sale
      del paso: no se publica fuera de la extensión de VS Code.
- [-] Paso 6 — plugins Maven/Gradle contra el tarball, imagen Docker; nocturno
      con repos públicos fijados. **Descartado por ahora, 2026-10-07 (decisión
      del usuario):** los plugins no interesan de momento.
- Fuera, dicho: extensiones de VS Code e IntelliJ (exigen el editor).

### Release 0.13.0 — lista para el piloto (2026-10-07)

- [x] Publicada en npm, GitHub Packages y Docker, verificada con el E2E contra
      el tarball del registro (31/31). Contenido: E2E de los 61 comandos;
      `done` pasa la puerta antes de escribir; `ci init` detecta el proveedor;
      [`docs/first-pr.md`](../docs/first-pr.md); README del bucle de cinco
      comandos (el de npm se actualiza con esta versión).
- [x] **MCP con el bucle diario.** Al actualizar el capítulo 15 del libro con
      las herramientas reales salió que `check` y `new` no eran herramientas
      MCP: un cliente sólo-MCP no podía crear un requisito ni pasar la puerta.
      Ahora sí, y cada herramienta declara su argumento (`title`,
      `requirement`, …).
- [x] Libro actualizado a 0.13 (163 páginas): `done` con puerta, `ci init`
      con detección, MCP real, sección «El primer PR del equipo» en el cap. 6.
- [ ] **El piloto con el equipo (#100).** Es lo único que queda, y es del
      usuario.

### Modelo de casos de uso y arquitectura (decidido 2026-10-07)

Debate con el usuario sobre proyectos grandes: un requisito se realiza con
varios casos de uso y un caso de uso cumple varios requisitos (N:M), con
`include`/`extend`; los tipos de requisito (funcional, no funcional, regla de
negocio) entran al caso de uso por sitios distintos; una historia de Jira es
una porción de caso de uso, no un requisito. Decidido en
[ADR-0027](../docs/specs/adr/0027-use-cases-are-a-layer-not-a-column.md) y
[ADR-0028](../docs/specs/adr/0028-architecture-conformance-is-part-of-the-gate.md);
especificación en [`docs/specs/use-case-model.md`](../docs/specs/use-case-model.md),
seis fases.

- [x] ADR-0027, ADR-0028 y especificación.
- [ ] Fase 1 — `arch_cmd` + SARIF + línea base en `check`, `done` y harness.
- [ ] Fase 2 — tipos de requisito, ficheros de caso de uso, escenarios por camino, grafo, `trace`, reglas.
- [ ] Fase 3 — `init` propone casos de uso por carpetas; migración de `use-cases.md`; packs N:M.
- [ ] Fase 4 — Jira: etiquetas `uc:`/`path:`, `alm status` por historia.
- [ ] Fase 5 — `impact`, entidades, conformidad caso de uso ↔ imports.
- [ ] Fase 6 — enlace BPMN comprobado.

## 4. La medida

Piloto con **personas del equipo** (cierra por fin el espíritu de `GATE-G3`),
dos o tres desarrolladores que no han tocado la herramienta, sobre un repo
real del equipo:

| Métrica | Umbral |
|---|---|
| De cero al primer PR con `check` verde en CI | ≤ 30 min, sin leer más que el Quickstart |
| Comandos distintos que usaron en una semana | ≤ 5 |
| Ediciones a mano de la matriz | 0 (no existe) |
| PRs que usaron `Spec: none` | Se registra; si es > 70 %, el núcleo no encaja y hay que saberlo |
| Respuesta a «¿lo seguirías usando sin que te obliguen?» | Mayoría sí |

Igual que en las rondas G6: las respuestas se comitean en crudo, incluidas las
que dejen mal a la herramienta.

## Lo que este plan no hace

- No toca la puerta determinista salvo para darle un nombre (`check`). Es el
  diferencial; simplificar no puede volver a vaciar el verde.
- No borra comandos en una minor: alias con aviso en 0.9, retirada en 1.0.
- No compite con Spec Kit en volumen de markdown ni con Kiro en IDE.
  Posicionamiento: **«OpenSpec + una puerta de CI que no miente»**.

## Regla de actualización

Cada tarea se marca `[x]` aquí al cerrarla, en la misma sesión, con su commit.
