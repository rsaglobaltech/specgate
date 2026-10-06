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
- [ ] `init` absorbe `adopt` y `onboard`
- [ ] `--help` de cinco verbos; el resto, alias con aviso
- [ ] `/csda:*` → `/specgate:*` con migración en `update`

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

**Objetivo:** el desarrollador habla con su agente; el CLI es lo que el agente y
la CI ejecutan.

- [ ] `specgate init` instala por defecto **skills/slash commands** en el agente
      detectado (no los 10 a la vez): `/spec:propose`, `/spec:apply`,
      `/spec:check`, `/spec:done`. Cada uno llama al CLI con `--json`.
- [ ] Un solo `AGENTS.md` corto (≤ 60 líneas) como contrato. `AI_RULES.md` se
      funde en él.
- [ ] Hook opcional (Claude Code / Kiro / git pre-push) que corre
      `specgate check` al terminar: la verificación determinista enganchada a un
      evento real (principio 12 del mercado, donde somos fuertes).

### Fase 3 — La matriz se genera, no se mantiene (2–3 semanas)

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

- [ ] Columnas por defecto: **Requisito · Escenario · Test · Estado**. Use Case,
      Command/Query, Aggregate y Event sólo con `profile: ddd`
      ([arquitectura-opcional-perfiles](arquitectura-opcional-perfiles.md) ya lo
      diseñó).
- [ ] Escenarios WHEN/THEN **dentro de `spec.md`** por defecto. `.feature`
      Gherkin sólo si el repo tiene Cucumber/behave/SpecFlow, o con `--gherkin`.

### Fase 5 — El proceso se ajusta al tamaño del cambio (3–4 días)

Respuesta directa a la crítica «waterfall» que reciben todas las herramientas SDD.

- [ ] Un bugfix o refactor **no necesita requisito nuevo**: `check` pasa si el
      PR no toca specs ni añade comportamiento (etiqueta o trailer
      `Spec: none`, visible en la revisión).
- [ ] `change` (deltas sobre specs ya entregadas) queda para cuando cambia un
      comportamiento contratado, no para todo.

### Fase 6 — Documentación de una página (3–4 días)

- [ ] `docs/` se reduce a: **Quickstart (10 min)**, Flujo diario, La puerta en
      CI, Brownfield, Referencia, Extensiones. Resto, a «Avanzado».
- [ ] `mejoras/`, `book/`, `BOOK_PLAN.md`, `GEMINI_BOOK_PROMPT.md` y
      `PLAN_PREDICTABLE_CODE_EVOLUTION.md` salen del repositorio del producto (a
      un repo de notas o a `docs/internal/` excluido de la web). Un recién
      llegado que abre el repo no debe ver 10k líneas de diario de diseño.
- [ ] Guía «primer PR con Specgate en tu equipo»: rol del revisor, qué mirar
      en el diff de la spec, qué hacer cuando `check` falla.

### Fase 7 — Congelar superficie

- [ ] Ninguna extensión nueva hasta que se cumpla la medida de abajo.
- [ ] Packs, specops, ALM, LSP, VS Code, Maven/Gradle, studio y harness se
      etiquetan *experimental* en la web; las que nadie del equipo use en el
      piloto se candidatan a otro repo.

---

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
