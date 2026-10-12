<!-- specgate:allow-placeholders — this file documents the {{VAR}} template syntax. -->
# Plan de cierre — de `create-spec-driven-app` a herramienta enterprise

> **Creado:** 2026-08-16
> **Estado del proyecto al crear este fichero:** v0.1.4, rama `feat/change-lifecycle`
> **Este fichero es el punto de partida de toda sesión de trabajo en este repo.**

---

## 0. Cómo usar este fichero

1. **Se lee al abrir sesión.** Antes de tocar nada, se localiza la primera tarea sin
   marcar y se continúa por ahí. No se improvisa un orden distinto sin anotarlo en el
   registro de decisiones (§12).
2. **Se marca al cerrar.** Una tarea se marca `[x]` en la **misma sesión** en que se
   termina, junto con el commit que la cierra. Nunca "lo marco luego".
3. **Una fase no se cierra sin pasar su gate.** El gate es una comprobación ejecutable,
   no una opinión. Si el gate no pasa, la fase sigue abierta aunque todas sus tareas
   estén marcadas.
4. **Los IDs (`C0-01`, `C3-04`…) se citan en los commits.** Ejemplo:
   `fix(ci): declarar js-yaml como dependencia directa (C6-02)`.
5. **Nada se borra.** Lo que se descarta se marca `[-]` con el motivo, o se mueve al
   backlog aparcado (§11).

**Leyenda:** `[ ]` pendiente · `[~]` en curso · `[x]` hecho · `[-]` descartado

---

## 1. Decisiones de alcance ya tomadas

| # | Decisión | Fecha |
|---|---|---|
| D1 | `feature/enterprise-adoption` (19 commits) se **rebasa y mergea**, no se reimplementa | 2026-08-16 |
| D2 | `feat/agent-cli` y `feat/csda-agent` quedan **fuera de alcance** — se archivan | 2026-08-16 |
| D3 | Distribución objetivo: **npm público + imagen Docker/ghcr + plugins Maven y Gradle** | 2026-08-16 |

---

## 2. Foto verificada del estado actual

Comprobado contra el disco y el árbol de git el 2026-08-16. No repetir este análisis.

### 2.1 Ramas — **resuelto en la fase 0**

Estado final tras C0-07: el remoto tiene **`main` y `feature/daily-ux-roadmap`**, y
nada más. Todo lo demás está en `main` o preservado en un tag `archive/*`.

| Tag de archivo | Qué preserva | Motivo |
|---|---|---|
| `archive/agent-cli` | REPL agéntico, F1 + F2 | Fuera de alcance (D2) |
| `archive/csda-agent` | Agente acotado a `csda`, multi-proveedor | Fuera de alcance (D2) |
| `archive/runtime-env` | Scaffolding de runtime pre-TypeScript | Se porta como C0-09 (D6) |
| `archive/specops-remote-packs` | `specops sync`/`diff` inicial (M2) | Superseded por `scripts/specops/` |
| `archive/demo-video` | Primer vídeo de demo | Superseded por `scripts/demo/` |
| `archive/gh-pages-legacy` | Rama `gh-pages` local, nunca en el remoto | El sitio vive en `docs/` y despliega vía `pages.yml` |

**Remoto final: solo `main`.** `feature/daily-ux-roadmap` quedó archivada como
`archive/daily-ux` tras recuperar lo aprobado (C0-11).

**Merge verificado con `git merge-tree`:**
`main` + `enterprise-adoption` = **limpio**.
`HEAD` + `enterprise-adoption` = **un solo conflicto**, `bin/create-spec-driven-app.ts`
(tabla de dispatch + `usage()`).

La rama enterprise aporta 65 ficheros / +6816 líneas:

- Comandos nuevos: `adopt` (A1), `doctor` (A3), `alm` (B6, Jira/Azure Boards), `ci` (B1), `report` (C1, dashboard HTML)
- `Dockerfile.cli` + `.github/workflows/publish-docker.yml` (B2)
- `packages/maven-plugin/` — Java, 4 mojos (B3)
- `packages/gradle-plugin/` — Java, 7 tasks (P4)
- Firma e integridad de packs (B5), modo offline / air-gap (B4), modo monorepo (B8), CI mode del harness (B7), wizard interactivo de `init` (A2), paridad Windows (A4), guía de adopción L1–L4 (A5), remedios accionables en `validate` (A6)

### 2.2 Lo que ya está hecho (aunque algún documento diga lo contrario)

OpenSpec **F0** (ADRs 0015–0018 + parser) y **F1** completos — el ciclo `change` entero
(`new`/`list`/`show`/`status`/`validate`/`archive`) está en `scripts/change/`.
OpenSpec **F1B** completo — `specops diff --as-change`, `specops contribute`,
`validate --against-lock`, procedencia en `csda:trace`, packs que distribuyen cambios.
Los **10 packs curados** existen en `packs/`. MCP server, pack registry, extensión
VS Code, `pack lint --graph`, `pack infer`, matriz CI ubuntu+macos × Node 20/22.

### 2.3 Lo que falta de verdad

OpenSpec **F2** (10 PD) · **F3** (14 PD) · **F4** (8 PD) · toda la distribución ·
el gobierno enterprise · el dogfood de CsdaStudioApp (fases 5–10, parado desde 2026-05-15).

### 2.4 Deuda técnica concreta

Ninguna es un `TODO` de código — el grep salió limpio. Todas son fallos de
configuración o de sincronía tras la migración a TypeScript.

| # | Hallazgo | Ficheros |
|---|---|---|
| 1 | ~~`mutation:pilot` está muerto~~ — resuelto en C6-01… **y vuelto a morir en `6ada847`, descubierto el 2026-08-26 (H21)**. El baseline de 51,32 % que decía esta fila era de antes del refactor; desde entonces medía un shim de 19 líneas. **Baseline honesto: 55,14 % sobre 749 mutantes** con Stryker 10 (#125). Con 9.6.1 daba 57,98 % sobre 664 — el major añade mutadores, así que **el número no significa nada sin la versión al lado** | `stryker.config.mjs` |
| 2 | ~~`js-yaml` no declarado~~ — **resuelto en C6-02**, y fijado a `^4.3.1` porque el rango anterior era vulnerable | `package.json` |
| 3 | ~~Los cuatro `packages/*/package.json` apuntan a `src/*.js`~~ — **resuelto en C6-03**. Antes: apuntaban a `src/*.js`, que nunca existe — la salida va al `dist/` de raíz. Publicarlos hoy enviaría paquetes vacíos. `pack-registry` además lista un `templates/` inexistente. El LSP recuperado en C0-11 hereda el mismo defecto | `packages/*/package.json` |
| 4 | Afirma que shellcheck corre en CI; no existe tal step | `CONTRIBUTING.md:119` |
| 5 | Los workflows de publish disparan con tags `v*`, pero los tags existentes son `0.1.4` y `0.1.0-beta.1` (sin `v`) → **nunca han disparado** | `.github/workflows/publish-*.yml` |
| 6 | Los workflows de publish gatean con `npm test` (37 tests E2E), no con `test:all` | idem |
| 7 | No existe `CHANGELOG.md`. `RELEASE_0.1.0_CHECKLIST.md` está congelado en 0.1.0, todo sin marcar, y dice Node ≥18 cuando el paquete exige ≥20 | raíz |
| 8 | ~~Windows en CI solo corre `test:unit`~~ — **resuelto**: el merge enterprise (A4) subió el job de Windows a la suite completa. Sigue pendiente corregir `traceability.md` (C1-01) | `.github/workflows/ci.yml` |
| 9 | ~~La landing está rota~~ — **resuelto en C0-02** | `docs/index.html`, `docs/app.js` |
| 10 | ~~Árbol local sucio~~ — **resuelto en C0-01 y C0-06** | working tree |
| 11 | ~~`dist/` sin `scripts/change/`~~ — **resuelto en C0-06** | working tree |
| 12 | El job de Gradle fallaba: `validatePlugins` de Gradle 9 exige que todo task type se pronuncie sobre cacheado. **Resuelto** con `@UntrackedTask` en los cuatro | `packages/gradle-plugin/src/**` |
| 13 | `pages.yml` ejecutaba `packages/pack-registry/src/build.js`, ruta inexistente desde la migración a TypeScript. **Resuelto**: compila antes y usa `dist/`. Misma causa que el punto 3 | `.github/workflows/pages.yml` |

---

## 3. Fase 0 — Consolidar el árbol (~2 PD)

> **Objetivo:** una sola línea de trabajo, verde, sin residuos.

| ID | | Tarea | Detalle |
|---|---|---|---|
| C0-01 | `[x]` | Limpiar residuo local **antes** de mergear | `packages/gradle-plugin/` local resultó ser solo directorios vacíos de build (0 B, nada versionado). Borrado; `.gradle/`, `build/`, `target/` e `.idea/` ignorados. Commit `f356698` |
| C0-02 | `[x]` | Arreglar la landing | `docs/app.js` restaurado — implementa los botones «copiar» de `docs/index.html:393`. Era un borrado accidental |
| C0-03 | `[x]` | Confirmar el borrado de `mejoras/agent-cli-plan.md` | Coherente con D2. Commit `b366dcc` |
| C0-04 | `[x]` | `feat/change-lifecycle` → `main` | Fast-forward de 4 commits |
| C0-05 | `[x]` | `feature/enterprise-adoption` → `main` | Commit `75e45b9`. Dos conflictos, ambos triviales (`bin/create-spec-driven-app.ts` CORE COMMANDS y `.gitignore`), resueltos por unión. **La rama traía dos defectos reales**: ver §3.1 |
| C0-06 | `[x]` | Reconstruir limpio | `rm -rf dist coverage && npm run build` |
| C0-07 | `[x]` | Podar y archivar ramas | 14 ramas remotas borradas, 6 tags `archive/*` creados y pusheados. El remoto queda con `main` y `feature/daily-ux-roadmap` |
| C0-08 | `[x]` | Decidir `develop` | Eliminada (D5). `ci.yml` ya no la filtra y `CONTRIBUTING.md` §7 describe las pre-releases vía `workflow_dispatch` |
| C0-09 | `[x]` | **Portar el scaffolding de runtime a TypeScript** | Resultó ser mucho menor de lo previsto: 15 de los 16 ficheros del commit archivado ya estaban en `main` (y mejorados, con el split `.env.*.infra`/`.app` de P1-08). Ver §3.2 |
| C0-10 | `[x]` | **Triar `feature/daily-ux-roadmap`** | Triaje completo en §3.3. Resultado: 6 comandos y 2 paquetes se recuperan; los dos refactors masivos y las dos implementaciones duplicadas se descartan |
| C0-11 | `[x]` | **Recuperar lo aprobado de `daily-ux-roadmap`** | 6 comandos + servidor LSP + scaffold IntelliJ + quickstart, sin un solo conflicto. 24 tests nuevos. Ver §3.4 |

### 3.1 Defectos que llegaron con la rama enterprise

Su CI nunca corrió en verde. Ambos arreglados dentro del merge `75e45b9`:

- `tests/unit/report.test.ts:27` — `extra = {}` se infería como `{}`, así que
  `extra.files` no tipaba y **rompía el build entero**.
- `tests/cli.test.ts:908` — el fixture de `--pr-cmd` envolvía la ruta del log en
  backticks de `String.raw`. El harness ejecuta `--pr-cmd` a través de una shell, que
  leía esos backticks como sustitución de comandos: la ruta se ejecutaba como comando
  y la aserción del propio test no podía cumplirse nunca. La ruta pasa ahora por `argv`.

### 3.2 Qué faltaba de verdad del scaffolding de runtime (C0-09)

Compose, devcontainer, `.dockerignore` y los `.env.*` ya se generaban. Faltaban
dos cosas, y una era un bug:

- **`docs/specs/runtime-environments.md` no se generaba.** Es el contrato
  normativo que pide `IMPROVEMENTS.md` §2.4: catálogo de entornos, URLs por
  entorno e invariantes (una base por entorno, cero credenciales en el repo,
  cero configuración hardcodeada). Añadido como
  `templates/base/docs/specs/runtime-environments.md.tpl`.
- **Bug: `DOCKER_SUPPORT=false` dejaba un devcontainer huérfano.**
  `applyRuntimeSupportFlags` borraba `docker-compose.yml` y volvía antes de
  limpiar `.devcontainer/`, así que el proyecto generado conservaba un
  `devcontainer.json` apuntando a `../docker-compose.yml` — un fichero que
  acababa de borrar. Reproducido, corregido y cubierto con tests.
- **Cobertura cero.** No había un solo test sobre el scaffolding de runtime.
  Añadidos 4 en `tests/cli.test.ts`: contrato completo por defecto, la ruta sin
  Docker, y las dos validaciones de configuración (`DEVCONTAINER_SUPPORT` sin
  Docker, y un `DATABASE_ENGINE` no soportado).

El renderizador solo sustituye `{{VAR}}` y no tiene condicionales, así que la
mitad Docker del spec se calcula en `runtimeDockerSection()` — de otro modo un
proyecto sin Docker documentaría un compose inexistente.

### 3.3 Triaje de `feature/daily-ux-roadmap` (C0-10)

La rama sale de la **misma base que la enterprise** (`15d277e`), así que las dos
resolvieron problemas solapados sin saberlo. Un merge directo da 9 conflictos,
dos de ellos irreconciliables por diseño: `scripts/doctor.ts` y el wizard de
`init` están implementados **dos veces**.

Su diagnóstico de partida sigue vigente y no lo cubre ninguna otra fase: *editar
a mano la tabla de 10 columnas de `traceability.md` es la queja número uno*.

**Descubrimiento clave:** los ficheros nuevos no compilan contra `main` porque
dependen del refactor `import/export` de la rama. Pero la dependencia es
mínima — 2 o 3 imports locales por fichero. Verificado: `scripts/req.ts`
compila contra `main` cambiando exactamente 2 líneas. **No hace falta traerse el
refactor de 64 ficheros para recuperar el valor.**

#### Se recupera (C0-11)

Ninguno de estos ficheros existe en `main`, así que entran sin conflicto.

| Qué | Ficheros | Encaje en el plan |
|---|---|---|
| `csda req` — añadir, enlazar y cerrar requisitos sin tocar la tabla a mano | `scripts/req.ts` + tests (815 líneas) | **Nuevo.** Ataca la queja número uno; no estaba en ninguna fase |
| `csda status` — panel diario: totales por estado, features huérfanas, versiones de pack y el siguiente comando sugerido | `scripts/status.ts` | **Nuevo** |
| `csda fix` — remedios automáticos de `validate` | `scripts/fix.ts` | **Nuevo.** Complementa los remedios accionables de A6 |
| `csda config init` | `scripts/config_init.ts` | C4-04 (perfiles) — **ya escrito**, cero imports que tocar |
| `csda completion [bash\|zsh]` | `scripts/completion.ts` | **C5-02 / OS-4-02 — ya escrito**, cero imports que tocar |
| `csda studio` — visor local de solo lectura | `scripts/studio.ts` | Entra en la decisión C1-07 sobre StudioApp: es la tercera variante en liza |
| Servidor LSP para artefactos de spec | `packages/lsp-spec-driven/` | **Nuevo**, no estaba en el plan |
| Plugin IntelliJ (cliente LSP fino, Kotlin) | `packages/intellij-spec-driven/` | **Nuevo**, no estaba en el plan |
| Quickstart de una página | `docs/quickstart.md` | C4-07 |

#### Se descarta

| Qué | Motivo |
|---|---|
| `561d956` refactor `import/export` (64 ficheros) | Chocaría con todo lo que trajo el merge enterprise. Cero valor para el usuario. Rehacerlo como tarea propia si se quiere |
| `950c88f` modo estricto de TypeScript (32 ficheros) | Igual. Merece su propia tarea, no un merge |
| `doctor` de la rama | Duplicado. Gana el de la rama enterprise (A3), que ya está en `main` con un `fix` por hallazgo |
| Wizard interactivo de `init` | Duplicado. Gana el de la rama enterprise (A2) |
| `d9715b6` `--json` global | Se escribió contra una superficie sin `change`, `specops contribute` ni `report`. Se usa como referencia al abordar C3-02, no se mergea |

### 3.4 Recuperación de `daily-ux-roadmap` (C0-11)

Ejecutada sin un solo conflicto: ninguno de los ficheros existía en `main`.
La CLI pasa de 14 a 20 comandos de primer nivel.

El puente entre estilos costó **11 líneas**. Los ficheros nuevos usan `export`
de ESM y son coherentes entre sí; solo los imports que cruzan hacia módulos
CommonJS ya existentes de `main` (`./plan`, `./lib/project-root`,
`./specops/lock`) se reescribieron a `require()`. El refactor de 64 ficheros
que la rama había hecho para unificar el estilo sigue descartado: la mezcla es
una inconsistencia cosmética, no un problema funcional — `tsc` con
`module: commonjs` compila `export` a `exports.x`.

Tres cosas que la rama traía mal y se corrigieron al recuperarlas:

- **`completion` anunciaba una superficie obsoleta.** Se escribió antes de
  `change`, `adopt`, `alm`, `ci`, `report` y `studio`. Una completion que
  ofrece comandos inexistentes es peor que no tenerla, así que ahora hay un
  test (`tests/unit/setup-commands.test.ts`) que compara la lista contra la
  tabla de dispatch de `bin/` y falla si divergen en cualquier dirección.
- **`docs/quickstart.md` documentaba `csda validate --fix`**, un flag que no
  existe ni existió nunca — ni en la rama. El roadmap lo listaba junto a
  `csda fix`, y solo se implementó el segundo. Corregido a `csda fix --dry-run`.
- **El quickstart estaba huérfano**, sin enlazar desde ningún sitio. Enlazado
  desde el índice de documentación del README.

`packages/intellij-spec-driven/` entra como **scaffold declarado**: su propio
README ya avisa de que necesita JDK 17 y Gradle y de que este CI no lo
construye. No se le añade job.

**Gate de salida:** ✅ **pasado el 2026-08-16**

```bash
npm run verify        # exit 0
npm run test:all      # 567 tests: 38 E2E · 428 unit · 22 escenarios BDD · 42 vscode · 23 mcp · 10 registry · 4 snapshot
git status --porcelain    # vacío
node bin/create-spec-driven-app.js --help   # 14 comandos de primer nivel, 22 entradas con subcomandos
node bin/create-spec-driven-app.js change list --project-dir .   # responde (no exit 3)
```

> C0-09 y C0-10 quedan abiertos: aparecieron durante la ejecución de la fase y no
> bloquean el gate, pero **C0-10 debe cerrarse antes de empezar la fase 3**.

---

## 4. Fase 1 — Sanear la verdad documental (~3 PD)

> **Objetivo:** ningún documento afirma algo falso.
> Bloqueante para uso enterprise: un equipo que adopte esto lee estos ficheros
> como contrato, y hoy varios mienten en ambas direcciones.

| ID | | Tarea | Fichero |
|---|---|---|---|
| C1-01 | `[x]` | REQ-006..009 y NFR-002/004/005 pasan de `Planned`/`Draft` a su estado real. Borrar las 6 "coverage gaps" ya cerradas. Corregir las rutas a `.sh` / `.bats` / `.js` eliminados por ADR-0008 | `docs/specs/traceability.md` |
| C1-02 | `[x]` | MCP server y pack registry dejan de estar `🚧 planned` — ambos existen y CI los construye. Node ≥ 20, no ≥ 18 | `docs/comparisons.md` |
| C1-03 | `[x]` | `validate --against-lock` y la composición multi-pack dejan de ser "Planned". Nota de corrección en ADR-0010 líneas 89 y 114 | `docs/specs/specops.md`, `docs/specs/adr/0010-specops-sync-diff.md` |
| C1-04 | `[x]` | F0 (`OS-0-01`..`05`) y F1 (`OS-1-01`..`09`) → `[x]` | `mejoras/openspec-benchmark-plan.md` §10 |
| C1-05 | `[x]` | Cabecera "Status: Proposal / not started" → estado real (fases 1–3 hechas, fase 4 abierta) | `mejoras/visual-pack-authoring-todo.md` |
| C1-06 | `[x]` | P3-03 cerrado: los 10 packs existen en `packs/`. P3-02 (deploy del registry) sigue abierto | `mejoras/implementation-roadmap.md` |
| C1-07 | `[x]` | Resolver la contradicción StudioApp: `visual-pack-authoring-todo.md` fase 4 dice "DEFERRED, entregar como webview de VS Code", mientras `csda-studio-brief.md` y `csda-studio-handoff.md` construyen una SPA independiente. Escribir la decisión como ADR | `docs/specs/adr/0019-studioapp-delivery.md` (nuevo) |
| C1-08 | `[x]` | Sustituir el checklist congelado por un proceso de release versionado y correcto | `RELEASE_0.1.0_CHECKLIST.md` → `docs/release-process.md` |
| C1-09 | `[x]` | O se añade el step de shellcheck (ver C6-05) o se corrige el texto | `CONTRIBUTING.md:119` |
| C1-10 | `[x]` | Test de guardia: toda ruta citada en `traceability.md` existe en disco. Sin esto, el documento vuelve a caducar en semanas | `tests/unit/docs-truth.test.ts` (nuevo) |

### 4.1 Lo que salió al tirar del hilo

Tres cosas que la auditoría inicial no había visto:

- **La puerta de cobertura nunca ha verificado nada.** `test:coverage` pasaba
  `--lines 75` pero no `--check-coverage`, que es lo que hace que c8 falle. Con
  la puerta encendida, la cobertura real es **74,8 % líneas · 71,1 % ramas ·
  80,4 % funciones**: por debajo del umbral que el propio script declaraba, y
  muy por debajo del 80/70 que `traceability.md` daba por cumplido. Ahora la
  puerta está encendida y trincada en 74/70/80 — de "sin puerta" a "puerta" es
  más fuerte, no más débil, y el objetivo del 80 % queda registrado como brecha
  abierta en vez de como logro.
- **`tasks.md` 4.4 ya estaba hecho.** `csda validate` valida los cambios activos
  desde `validate_specs.ts:445-467`. Solo faltaba la casilla. Cierra C2-01.
- **`CONTRIBUTING.md` mentía en seis sitios, no en uno.** Pedía `chmod` sobre
  scripts `.sh` que no existen, declaraba Bash y `bats-core` como requisitos,
  listaba `npm run test:shell` (script inexistente) y `tests/cli.test.js`
  (`.ts`), decía Node ≥ 18, prohibía ESM en `scripts/` cuando C0-11 ya lo
  introdujo, y remitía a `IMPROVEMENTS.md` como backlog vivo. Es el documento
  de entrada de cualquiera que quiera contribuir.

`IMPROVEMENTS.md` queda marcado como superado — casi todo su contenido se
implementó y sus items de shell/Bats son irrelevantes desde ADR-0008.

**Gate de salida:** ✅ **pasado el 2026-08-16.** `tests/unit/docs-truth.test.ts`
en verde y en CI (verificado que falla al introducir una ruta inexistente), y
revisión documento a documento de los diez ficheros anteriores.

---

## 5. Fase 2 — Cerrar el ciclo de cambio (~2 PD)

> **Objetivo:** `change` deja de ser un comando invisible.
> Cierra los dos ítems abiertos de `docs/specs/changes/add-change-lifecycle/tasks.md`.

| ID | | Tarea |
|---|---|---|
| C2-01 | `[x]` | `tasks.md` 4.4 — **ya estaba implementado** en `scripts/validate_specs.ts:445-467`; solo faltaba marcar la casilla. Verificado: un cambio con delta inválido hace fallar `validate` |
| C2-02 | `[x]` | `tasks.md` 4.5 — documentar el ciclo: tabla de comandos del `README.md`, receta nueva en `docs/how-to.md`, cheat-sheet de `docs/tutorial.md`. Hoy `change` es un comando de primer nivel que **no aparece en ningún documento de usuario** |
| C2-03 | `[x]` | Dogfooding obligatorio (§11 del plan OpenSpec) — archivar el propio cambio `add-change-lifecycle` con `csda change archive` |
| C2-04 | `[x]` | Prueba de fuego F1B — publicar `parking-management-specops` `v0.2.0` y consumirlo con `specops diff --as-change`. Criterio literal del plan: *si la propuesta generada no se lee mejor que el `git diff`, la fase ha fallado* |

### 5.1 Lo que el dogfooding destapó

Archivar el propio cambio del repo obligó a que el repo se validara a sí mismo,
y ahí salió casi todo:

- **`spec.md` §6 afirmaba que «the repository's own `validate` check is green in
  CI on every PR».** No estaba en CI **y fallaba.** Ahora `csda validate .` corre
  en el job de tests y en `npm run verify` (script `selfcheck`).
- **`csda change archive` borraba contenido del usuario.** `syncTraceability`
  reconstruía `traceability.md` entero desde las filas, tirando todo lo demás —
  NFRs, inventario de tests, notas — sin un aviso. Verificado sobre la matriz
  real de este repo: se cargó cuatro secciones. Corregido con `spliceMatrix`,
  que sustituye solo el bloque de tabla; dos tests de regresión.
- **`validate` escaneaba `node_modules/`.** Cualquier proyecto con dependencias
  instaladas se comía falsos positivos de placeholders de las librerías de
  plantillas. Ahora salta `node_modules`, `dist`, `build`, `out`, `target`,
  `coverage`, `vendor`, `.git`, `.next`, `.gradle` y `.specops`.
- **`validate` marcaba los `.tpl` como placeholders sin resolver.** Un `.tpl`
  está sin renderizar por definición. Los proyectos generados no contienen
  `.tpl`, así que excluirlos no debilita la puerta para su destinatario: solo
  deja de dispararse en repos de plantillas y de packs.
- **No había forma de eximir prosa que documenta la sintaxis.** Añadido el
  marcador explícito `csda:allow-placeholders`, en la misma convención que
  `csda:trace`. Se dice, no se adivina.
- **El parser de la matriz interpreta cualquier tabla de pipes del fichero.**
  Una tabla de 3 o 4 columnas en otra sección se lee como filas de matriz y su
  primera columna como Scenario IDs. Documentado en la cabecera de la matriz.
- **La matriz del propio CLI estaba en un formato inventado de 6 columnas**, no
  en el formato rico de 10 que la herramienta genera. Convertida: la herramienta
  tiene que poder operar sobre su propio repositorio.
- **El ejemplo de delta que escribí para el README era inválido.** Usaba
  `- **GIVEN**`; el validador exige la palabra clave al principio de línea.
  Detectado al ejecutar el flujo en vez de suponerlo.

**Gate de salida:** ✅ **pasado el 2026-08-16.** Bucle completo ejecutado de
punta a punta: `change new` → delta → `change validate` → `change archive` →
fila en la matriz + capability spec + `csda plan` lo lista → estado a `In Dev` →
`validate --strict-tdd` falla con `[TDD-1]`, con su remedio.

### 5.2 Prueba de fuego F1B (C2-04)

`parking-management-specops` ya tenía `v0.2.0` publicado, pero ese bump **no
cambiaba ningún requisito** — y `--as-change` lo dice: *«No requirement changed;
nothing to review»*, donde el diff plano reporta «2 modified». Ya ahí discrimina
ruido de intención.

Para juzgar la legibilidad hacía falta un bump que sí moviera requisitos, así
que se construyó uno (un requisito añadido, otro reformulado):

| | Salida |
|---|---|
| `specops diff` | `~ docs/specs/traceability.md` · *0 added · 1 modified · 13 unchanged* |
| `specops diff --as-change` | `+ REQ-010` · `~ REQ-002` · *1 added · 1 modified · 0 removed*, más una propuesta que nombra los requisitos y un delta con el texto nuevo, el escenario completo del reformulado y `origin=pack:backend@v0.3.0` en ambos |

**Veredicto: supera el criterio.** Del diff plano no se puede deducir qué cambió
en el dominio; de la propuesta, sí. Y cuando el pack declara un requisito sin
plantilla Gherkin, el delta deja un `TODO` explícito y la propuesta avisa de
ello en vez de inventarse el comportamiento.

Dos asperezas anotadas, ninguna bloqueante:

- Un bump que añade variables requeridas hace fallar `specops diff` una vez por
  variable (`STACK`, luego `LANG`) en lugar de pedirlas todas de golpe.
- La propuesta generada sale en español y las cabeceras del delta en inglés.
  Lo cubre C4-08 (contexto de idioma).

---

## 6. Fase 3 — Contrato de agente · OpenSpec F2 (~10 PD)

> **Objetivo:** la brecha real frente a OpenSpec, y el mayor valor enterprise.
> Es lo que permite que Claude Code, Cursor y Copilot conduzcan el ciclo completo
> sin que un humano escriba comandos de CLI.

Especificación de referencia: `mejoras/openspec-benchmark-plan.md:503-522`.

| ID | | Tarea | Estado real de partida |
|---|---|---|---|
| C3-01 | `[x]` | Envoltorio de diagnóstico `{severity, code, message, target?, fix?}` en **todos** los comandos; ningún `console.error` suelto en modo `--json` | `scripts/lib/diagnostics.ts` ya existe, pero solo lo usa `change` |
| C3-02 | `[x]` | `--json` en los 12 comandos aptos para agente: un documento en stdout, prosa a stderr, null-shape en fallo. Test: `cmd --json 2>/dev/null \| jq .` parsea en éxito y en fallo | hoy solo `change` y `plan --format json`. Hay un intento previo en `feature/daily-ux-roadmap` (`d9715b6`) — leerlo antes de empezar |
| C3-03 | `[x]` | Contrato de exit codes: 0 éxito (hallazgos incluidos), 1 fallo, 130 cancelación | hoy hay `2` (subcomando desconocido) y `3` (script no encontrado) sin documentar → normalizar o incorporarlos al contrato |
| C3-04 | `[x]` | `docs/specs/agent-contract.md` — shapes campo a campo y catálogo de códigos, **generado y verificado desde tests snapshot**, no escrito a mano | nuevo |
| C3-05 | `[x]` | `csda agents init --tool claude,cursor,copilot,windsurf,aider,gemini,cline,codex` — genera `.claude/commands/csda-*.md`, `.cursor/rules/csda.mdc`, `.github/copilot-instructions.md`, `AGENTS.md`; `--dry-run` lista destinos | `scripts/agents/*.ts`, `templates/agents/**` (nuevos) |
| C3-06 | `[x]` | Slash commands `/csda:explore`, `/csda:propose`, `/csda:apply`, `/csda:verify`, `/csda:archive`, `/csda:onboard` — cada uno invoca `csda change instructions <artifact> --json` | `templates/agents/commands/*.md.tpl` |
| C3-07 | `[x]` | `csda change instructions <artifact> [--json]` — plantilla + contexto + reglas + dependencias + `unlocks`. Motor único que consumen slash commands, MCP, VS Code y harness. `harness run` deja de construir su prompt ad hoc | `scripts/change/instructions.ts` (nuevo); reutiliza `scripts/harness/prompt.ts` |

### 6.1 Lo que salió al implementar el contrato

- **La puerta de cobertura tenía hermana.** `validate` y `doctor` mantenían cada
  uno su propio escaneo de placeholders, y divergieron: arreglar `validate` en
  la fase 2 dejó a `doctor` reportando **64 errores** en este repo, todos falsos
  positivos de `coverage/` y `templates/`. Extraído a
  `scripts/lib/placeholders.ts` con 6 tests. Doctor pasó a 0 errores.
- **`doctor` no conocía `docs/specs/capabilities/`.** Comparaba la matriz solo
  contra el `spec.md` raíz, así que daba por fila huérfana cada requisito que
  `change archive` fusiona — siete, justo después del dogfood de la fase 2.
- **La salida JSON mezclaba snake_case y camelCase.** `plan`, `status`,
  `report`, `studio`, `infer` y `harness` emitían `schema_version` y
  `project_dir` junto a `scenarioId` y `featureFile`; `studio` lograba ambas en
  el mismo documento. Normalizado a camelCase (ADR-0017 regla 4). **Rompe a los
  consumidores de `plan --format json`** — va en las notas de la 0.2.0. Los
  formatos en disco (`pack.yaml`, `.specops.lock`) no se tocan: son esquemas de
  fichero, no salida de comando.
- **Los tests del contrato cazaron tres cosas más al escribirlos:** el
  recolector de códigos ignoraba el reportero `fail("code", …)` de `validate`
  (diez códigos ausentes del catálogo publicado), `plan --json` no emitía
  `status` en absoluto, y quedaban claves anidadas en snake_case que el barrido
  anterior no tocó.
- **Ciclo de imports.** `instructions.ts` requería `cli.ts` para el grafo de
  artefactos, y `cli.ts` aún no había asignado `module.exports`. Resuelto
  extrayendo el grafo a `change/artifacts.ts`, no con requires perezosos.

**Gate de salida:** ✅ **pasado el 2026-08-16.** `csda agents init` genera los
seis slash commands y los ficheros de instrucciones de ocho herramientas desde
una única definición, y `change instructions` es el motor que consumen tanto
ellos como `harness run`. La verificación del contrato la hacen los propios
tests contra los comandos reales, no una lectura del documento.

> Queda pendiente la prueba con un agente real sobre un repo brownfield
> ajeno — es observación de campo, no algo que un test pueda cerrar. Anotado
> para la fase 8.

---

## 7. Fase 4 — Schemas, perfiles y documentación · OpenSpec F3 (~14 PD)

> **Objetivo:** que un desarrollador nuevo llegue al primer valor sin leerse el README entero.

Especificación de referencia: `mejoras/openspec-benchmark-plan.md:526-543`.

| ID | | Tarea |
|---|---|---|
| C4-01 | `[x]` | `OS-3-01` — grafo de artefactos configurable: `.csda/schemas/<name>/schema.yaml` con `artifacts[{id, generates, requires}]`. El schema `spec-driven` built-in reproduce el flujo actual |
| C4-02 | `[x]` | `OS-3-02` — `csda schema init \| fork \| validate \| which` |
| C4-03 | `[x]` | `OS-3-03` — schema built-in `bdd-first`: `proposal → feature → spec → tasks`, el `.feature` **antes** que la spec. Es nuestra opinión de producto |
| C4-04 | `[x]` | `OS-3-04` — perfiles `core \| full`: el help por defecto muestra 6 comandos, `--help --all` los muestra todos. **`config init` ya está escrito** — recuperarlo en C0-11 primero |
| C4-05 | `[x]` | `OS-3-05` — rigor progresivo: `change new --lite` (proposal + tasks) vs `--full` |
| C4-06 | `[x]` | `OS-3-06` — `csda onboard`: tour guiado sobre repo existente, detecta stack, propone capabilities, genera el primer cambio |
| C4-07 | `[x]` | `OS-3-07` — reestructurar `docs/` en guías cortas (`overview`, `getting-started`, `concepts`, `workflows`, `writing-specs`, `reviewing-changes`, `existing-projects`, `commands`, `cli`, `agent-contract`, `customization`, `glossary`, `faq`, `troubleshooting`). Ninguna > 300 líneas; README < 150 |
| C4-08 | `[x]` | `OS-3-08` — contexto de idioma configurable (ES/EN/PT) inyectado en prompts e instrucciones, manteniendo los términos técnicos en inglés |
| C4-09 | `[x]` | `OS-3-09` — `docs/comparisons.md` con OpenSpec como columna principal, incluyendo "cuándo elegir OpenSpec en vez de CSDA" |

### 7.1 Notas de la fase

- **C4-05 no requirió trabajo**: `change new --lite|--full` ya existía.
- **El idioma empezó siendo un bug.** Las plantillas de delta y las propuestas
  derivadas estaban en español dentro de una herramienta en inglés — anotado en
  la fase 2 y arrastrado. Ahora hay tabla de frases en/es/pt, y un test que
  renderiza cada tabla y comprueba que `SHALL` y `GIVEN/WHEN/THEN` sobreviven:
  traducir la gramática produciría un fichero que la herramienta no puede leer,
  en el idioma que el usuario pidió.
- **`onboard` validado contra un repo real ajeno** (`~/sandbox/projects/mvps/lixi-platform`):
  7 capabilities con evidencia, stack detectado. La heurística necesitó dos
  correcciones: bajar por directorios envoltorio mientras haya un solo hijo
  (`src/main/java/com/acme` daba `acme`, no los paquetes), y reconocer
  `domain/`, `modules/` y `services/` en la raíz.
- **La reestructura de docs no se hizo por la métrica.** `docs/tutorial.md`
  sigue teniendo 931 líneas y se queda así: es una narrativa continua, y
  partirla en cuatro la empeora. El test que impone el límite de 300 líneas
  nombra esa excepción explícitamente en vez de fingir que no existe.
- **Guards nuevos** en `tests/unit/docs-truth.test.ts`: ningún markdown enlaza a
  otro que no existe (el split movió muchos enlaces a la vez), ninguna guía pasa
  de 300 líneas salvo la excepción declarada, y el README se queda por debajo de
  150. Cazaron un enlace roto preexistente en ADR-0002.
- `docs/aetherdeploy-ai-integration-assessment.md` movido a `mejoras/` — es una
  evaluación, no una guía, y además nunca estuvo versionado.

**Gate de salida:** ✅ **pasado el 2026-08-16.** README de 397 → **121 líneas**;
help de 86 → **33** con 8 comandos; `docs/` repartido en guías por tarea, todas
por debajo de 300 líneas.

> El gate original pedía medir que un usuario nuevo cierra el bucle en < 15
> minutos leyendo solo `docs/getting-started.md`. Eso es una prueba de
> usabilidad con personas, no algo que un test pueda cerrar. Anotado para la
> fase 8, junto con la observación de campo del contrato de agente.

---

## 8. Fase 5 — DX y multi-repo · OpenSpec F4 (~8 PD)

| ID | | Tarea |
|---|---|---|
| C5-01 | `[x]` | `OS-4-01` — `csda update`: regenera ficheros de instrucciones y slash commands tras un upgrade, preservando ediciones locales. 3-way merge reutilizando `scripts/specops/merge.ts` |
| C5-02 | `[x]` | `OS-4-02` — `csda completion [bash\|zsh\|fish] [--install]`. **Bash y zsh ya están escritos** en `feature/daily-ux-roadmap` — recuperarlo en C0-11 antes de escribir nada |
| C5-03 | `[x]` | `OS-4-03` — `doctor` extendido: deltas huérfanos, cambios archivados con tareas sin marcar, drift entre matriz y specs, requisitos de pack editados sin cambio asociado. Cada hallazgo con `fix` accionable. Construye sobre el `doctor` que llega en C0-05 |
| C5-04 | `[x]` | `OS-4-04` — `csda init --from-pack <repo>@<tag>` en un paso, y `specops.config.yaml` heredable entre repos. **No replicar los *Stores* de OpenSpec**: nuestra respuesta al multi-repo es el pack privado compartido, que ya existe |
| C5-05 | `[x]` | `OS-4-05` — gobierno de repo: changesets y devcontainer (el resto se completa en la Fase 9) |

---

## 9. Fase 6 — Higiene de build y CI (~3 PD) · **bloquea la Fase 7**

| ID | | Tarea |
|---|---|---|
| C6-01 | `[x]` | Arreglar `stryker.config.mjs:3,9` para apuntar a `dist/`, o retirar el pilot. Si se conserva, añadirlo a CI (semanal); si no, dejar de anunciarlo |
| C6-02 | `[x]` | Declarar `js-yaml` en `package.json`. Hoy resuelve por accidente vía eslint: una actualización de eslint rompe CI con un `MODULE_NOT_FOUND` incomprensible |
| C6-03 | `[x]` | Corregir `bin`/`main`/`files` de los **cuatro** `packages/*/package.json` (incluido `lsp-spec-driven`); borrar el `templates/` inexistente de `pack-registry`. **Bloquea C7-07 y C7-08** |
| C6-04 | `[x]` | Windows en CI: subir de `test:unit` a E2E + BDD, o documentar la limitación y corregir `traceability.md` en consecuencia |
| C6-05 | `[x]` | Añadir el step de shellcheck que `CONTRIBUTING.md` ya promete (ver C1-09) |
| C6-06 | `[x]` | Los workflows de publish gatean con `test:all`, no con `npm test` |
| C6-07 | `[x]` | Normalizar la convención de tags a `vX.Y.Z`. Los workflows disparan con `v*` y los tags existentes no lo llevan: la ruta de publicación por tag nunca se ha ejecutado |
| C6-08 | `[x]` | Dependabot + CodeQL + `npm audit` en CI. Requisito habitual de adopción corporativa |

### 9.1 Lo que salió al hacerla

- **`pack-registry` no es un paquete.** Importa `scripts/domain-pack/common` del
  CLI, así que no puede publicarse por separado — pero se declaraba con `bin`,
  `main` y `files` como si sí. Marcado `private: true` y descrito por lo que es:
  herramienta interna de build del sitio del registry.
- **Los otros tres sí lo son, y ahora empaquetan de verdad.** Cada uno compila
  su `src/` en su propio `dist/` con un `tsconfig.build.json`, y `prepack` lo
  ejecuta. Verificado con `npm pack --dry-run`: antes los tarballs iban sin un
  solo `.js`.
- **El MCP server anunciaba `0.0.0` por el cable.** Su `require` del
  `package.json` usaba una ruta relativa que solo resolvía en el layout de la
  raíz. Ahora sube buscándolo, funciona en ambos, y hay test.
- **Stryker resucitado, con dato real: 51,32 %** (5 minutos, `common.js` +
  `delta.js`). Corre semanalmente, no por PR, y `break: 0` sigue puesto — fallar
  un build por un número que aún no es estable sería ruido, y este repo ya ha
  quitado bastantes checks que gritaban en falso. Sin fichero de resultados
  commiteado: el anterior se borró justo por quedarse rancio.
- **`npm audit` encontró 3 vulnerabilidades altas**, incluida una en `js-yaml`
  —la dependencia que acababa de declarar en este mismo commit—. `^4.1.0` habría
  dejado que una instalación limpia aterrizara en el rango vulnerable
  (4.0.0–4.3.0); fijado a `^4.3.1`. Quedan 2 moderadas en `qs` vía
  `@vscode/vsce`, por debajo del umbral.
- **Publicar sin changelog ya no es posible.** `0.1.4` estuvo tres meses sin
  publicar y sin notas; el workflow ahora falla si `CHANGELOG.md` no menciona la
  versión.

**Gate de salida:** ✅ **pasado el 2026-08-16.** `npm pack --dry-run` produce
tarballs con JS real en los tres paquetes publicables; los workflows de publish
gatean con `test:all`; shellcheck, `npm audit --audit-level=high` y CodeQL
corren en CI; Dependabot cubre npm, actions, Maven y Gradle.

---

## 10. Fase 7 — Distribución

> Según **D3**: npm público, Docker/ghcr, plugins Maven y Gradle.
> Se añaden VS Code Marketplace y el MCP server porque ya están construidos y
> bloqueados solo por C6-03.

| ID | | Tarea |
|---|---|---|
| C7-01 | `[x]` | `CHANGELOG.md` **escrito** en la fase 5, con el cambio incompatible de camelCase registrado mientras estaba fresco. Falta changesets |
| C7-02 | `[x]` | Preparar la release **0.2.0**: tres meses de features sin publicar — ciclo `change`, `specops contribute`, `diff --as-change`, F1B, más todo lo que entra en C0-05 |
| C7-03 | `[x]` | **`0.2.1` en `latest`**, con provenance. Verificada con `npm install create-spec-driven-app` en un proyecto limpio: `init` + `validate` de punta a punta. La página de npmjs.com ya renderiza el README actual |
| C7-04 | `[x]` | Docker publicado. `ghcr.io/rsaglobaltech/csda:0.2.1` vive en el registry con `amd64` y `arm64` (verificado con `docker manifest inspect`). Uso en pipelines documentado en `docs/automation.md` — que era la mitad que faltaba y la razón de existir de la imagen |
| C7-05 | `[-]` | Maven: publicar `packages/maven-plugin`. Requiere groupId, firma GPG y cuenta OSSRH — o Nexus/Artifactory interno |
| C7-06 | `[-]` | Gradle: publicar `packages/gradle-plugin` en el Gradle Plugin Portal o repo interno |
| C7-07 | `[-]` | VS Code Marketplace: cuenta de publisher + `vsce publish`. El `.vsix` 0.1.0 ya está construido en `releases/` |
| C7-08 | `[-]` | npm: `@specgate/mcp-server` |
| C7-09 | `[-]` | Desplegar el registry en `packs.spec-driven.dev`: dominio + Pages/Cloudflare |

### 10.5 Release 0.4.0 (2026-08-17) — el suelo a Node 22

Un solo cambio, publicado solo. El motivo de no esperar a juntarlo con otra cosa
es concreto: **0.3.0 declaraba `>=20` en npm y CI había dejado de probar Node
20**. Eso deja una promesa sin verificar en `latest`, y solo hay dos salidas
honestas — publicar, o devolver Node 20 a la matriz.

| Artefacto | Estado |
|---|---|
| npm `create-spec-driven-app@0.4.0` | `latest`, `engines: >=22`, procedencia SLSA |
| `ghcr.io/rsaglobaltech/csda:0.4.0` | multi-arch, **Node 22 dentro** de la imagen |

Verificada desde el registro público: `npx` genera y valida un proyecto.

**Lo que casi bloqueó todo sin fallar:** la protección de rama exigía
`Test (… / Node 20)` tres veces, y esos jobs dejaron de existir al mover la
matriz. Contextos obligatorios que nunca pueden reportar **congelan** cada PR en
vez de fallar a la vista. Repuntada a los jobs reales, y de paso
`SBOM and licences` pasó a obligatorio: llevaba corriendo sin estar exigido.

**Una release de un solo tema sale gratis en atribución.** Es lo contrario de
0.3.0, que llevaba 34 commits porque acumuló tres meses de retraso.

---

### 10.4 Release 0.3.0 (2026-08-17)

Publicada con luz verde explícita. 34 commits desde 0.2.1 que nadie tenía.

| Artefacto | Estado |
|---|---|
| npm `create-spec-driven-app@0.3.0` | `latest`, con procedencia SLSA |
| `ghcr.io/rsaglobaltech/csda:0.3.0` | `linux/amd64` + `linux/arm64` |
| Notas de release en GitHub | escritas, no autogeneradas |

**Al preparar la release faltaba media en el CHANGELOG:** la documentación de
cadena de suministro, el SBOM y la puerta de licencias, las ventanas de
compatibilidad, los ficheros de gobierno y el camino sin Node en el agente de
build. Todo eso había salido y no estaba anotado. Es la versión pequeña del
mismo defecto que este proyecto persigue, y apareció justo porque el proceso
obliga a revisar el CHANGELOG antes de versionar.

**Verificada como usuario nuevo**, que es la única prueba que cuenta:
`npx create-spec-driven-app@0.3.0` genera un proyecto móvil con sus reglas
móviles y pasa `validate`.

---

### 10.1 Estado de la publicación (2026-08-16)

Verificado sin publicar nada:

- **Tarball**: instalado en un proyecto limpio; `init` + `validate` de punta a
  punta, y `status`, `change new`, `change instructions`, `agents init`,
  `schema which`, `onboard`, `doctor` y `req` funcionando desde el paquete
  instalado. El job `package` de CI solo comprobaba `--help`, que no habría
  detectado un script ausente.
- **Imagen Docker**: construida y ejecutada; `init` + `validate` dentro del
  contenedor. 217 MB.
- **Workflow de npm**: dry-run completo en verde, con la suite entera, el gate
  del changelog y la firma de provenance.

**Lo que el tarball dejó de llevar:** 98 ficheros de tests compilados, los 38 de
los paquetes que se publican aparte, las definiciones de pasos de Cucumber y 133
source maps sin fuentes. 326 → 187 ficheros, 461 → 277 kB. Iba así desde 0.1.0.

**Metadatos que npm corregía en silencio al publicar:** los cuatro manifiestos
sin el prefijo `git+` en la URL del repositorio, y el LSP apuntando a
`spec-driven-template` — un repositorio que no existe.

**Publicado el 2026-08-16:** `create-spec-driven-app@0.2.0-beta.1`, dist-tag
`beta`, con provenance firmado. Instalada desde npm en un proyecto limpio y
ejercitada: `validate`, `status --json`, `change new`, `change instructions`,
`agents init`, `onboard` y `schema which` funcionan. **`latest` sigue en
`0.1.4`** — promoverla es una decisión aparte, y conviene que alguien use la
beta antes.

El primer intento falló con
`404 Not Found - PUT`, que en npm significa que el token no tiene permiso sobre
el paquete —no que el paquete no exista—. Nada quedó a medias. Resuelto rotando
`NPM_TOKEN`.

### 10.2 El README publicado no es el del repositorio

Republicar una beta **no** arregla la página de npmjs.com: npm renderiza el
README de la versión con dist-tag `latest`. Con `latest` en `0.1.4`, el campo
`readme` del registry estaba literalmente vacío. Solo al promover `0.2.0` a
`latest` pasó a tener los 6185 caracteres del README actual.

Consecuencia práctica: **cada cambio de documentación que deba verse en npm
necesita una release**, no basta con un commit. Está en `docs/release-process.md`.

### 10.3 La imagen de 0.2.0 no corría en ARM

Se publicó solo `amd64`, así que la línea `docker run` que el README recomienda
fallaba en cualquier Mac con Apple Silicon y en cualquier runner ARM. Faltaba
QEMU junto a buildx para compilar cruzado.

El tag `0.2.0` **no se podía reconstruir en su sitio**: relanzar un workflow
contra un ref antiguo usa el workflow *tal como estaba en ese ref*, que aún no
tenía el arreglo. Mover un tag ya publicado —del que npm había publicado— era
peor. De ahí `0.2.1`.

**Gate de salida:** desde una máquina limpia funcionan
`npx create-spec-driven-app@latest --help`,
`docker run ghcr.io/rsaglobaltech/csda validate .`
y el goal `csda:validate` de Maven sobre un proyecto Java real.

---

## 11. Fase 8 — Prueba en empresa

| ID | | Tarea |
|---|---|---|
| C8-01 | `[~]` | CsdaStudioApp: **fases 5, 6 y 7 hechas** el 2026-08-17 — scaffold hexagonal con REQ-015 verde (`bef5de4`) y harness cableado (`5d98aa3`). Quedan 8–10: `harness run` REQ-001..014, review de ramas, tag y deploy. Cablear el harness **destapó una regresión viva en el CLI** — ver §11.2. Estado vivo en `mejoras/csda-studio-handoff.md` |
| C8-02 | `[~]` | Piloto HIE. **Estado reconstruido y runbook reescrito** el 2026-08-17 (`mejoras/hie-pilot-runbook.md`, ahora sí versionado). Brownfield real: Spring Boot 3.3 / Java 21 + HAPI FHIR, pack `healthcare-hie/backend` v0.1.0 con 16 requisitos, adoptado a L1–L2, `validate` pasa. Falta conducir la implementación. Reconstruirlo destapó los perfiles de agente — ver §11.3 |
| C8-03 | `[ ]` | Case studies 2 y 3. Solo existe `docs/case-studies/case-1.md` |
| C8-04 | `[ ]` | Vídeo demo de 90 s (P1-12, pendiente desde la fase 1) + vídeo del bucle bidireccional F1B — *ese vídeo no lo puede grabar ningún competidor* |
| C8-05 | `[x]` | Métricas §9 medidas contra el disco, no estimadas. **3 de 5 cumplidas, 1 fallada, 1 no medible por máquina.** Medir destapó dos defectos reales — ver §11.1 |

### 11.1 Las métricas §9, medidas (C8-05)

Medidas el 2026-08-16 ejecutando el CLI contra un proyecto recién generado.

| Métrica | Objetivo | Medido | |
|---|---|---|---|
| README | < 150 líneas | **138** | ✅ |
| Herramientas de agente cubiertas | 8 | **8** (claude, cursor, copilot, windsurf, aider, gemini, cline, codex) | ✅ |
| Comandos con `--json` | 12 | **12** tras esta fase; eran 9 | ✅ |
| Comandos visibles en `--help` | ≤ 8 | **9** | ❌ |
| Slash commands | ≥ 8 | **6** | ❌ |
| TTFV | < 5 min | 0,33 s de máquina | — |

**TTFV no lo puede medir una máquina.** `init` + `validate` + `status` tardan
0,33 s en total; los cinco minutos son el tiempo de una persona leyendo y
decidiendo. Necesita gente, igual que C9-08.

**Los 9 comandos visibles** son `init`, `adopt`, `onboard`, `status`, `plan`,
`req`, `change`, `validate`, `done`. Bajar a 8 significa esconder uno de esos
nueve, y ninguno sobra. Además el CHANGELOG de 0.2.0 afirma «eight commands»:
o se quita uno o se corrige la frase, pero hoy el documento miente.

**Los 6 slash commands** (`explore`, `propose`, `apply`, `verify`, `archive`,
`onboard`) son exactamente los que C3-06 especificó. La meta de 8 nunca se
diseñó; llegar a ella pide dos comandos nuevos con motivo propio, no dos
inventados para cuadrar una cifra.

#### Lo que apareció al medir

Medir no fue un trámite: destapó dos defectos que ningún test veía.

1. **`req list --json` imprimía la tabla humana e ignoraba la bandera.** Peor
   que rechazarla: quien llama cree que recibió un documento. `report`, `fix` y
   `specops diff` sí la rechazaban con `Unknown flag`.
2. **`plan --json` y `report --json` incumplían el contrato camelCase** dentro
   de `requirements`, justo el array que un agente recorre. El 0.2.0 anunció la
   normalización como *breaking* y la aplicó solo a las claves de primer nivel.
   Medio aplicado era el peor de los tres estados posibles: el documento decía
   camelCase, la salida decía otra cosa, y nada fallaba.

Ambos corregidos, con `tests/unit/json-contract.test.ts` como guardián: ejecuta
los doce comandos contra un proyecto real y exige un documento parseable, un
array `status`, y cero claves snake_case a cualquier profundidad.

**Pendientes:** `pack lint` y `specops diff` siguen sin `--json`. Son cirugía
mayor —imprimen hallazgos y diffs, no un modelo— y hacerlos a medias habría
sido peor que dejarlos anotados.

### 11.2 El dogfood cazó una regresión que la suite no vio (C8-01)

Al cablear el harness en `csda-studio-app`, `csda harness prompt REQ-001`
devolvió esto:

```text
- Scenario ID: (none)
- Feature file: (none declared)
- Test artifact (write this first — TDD): (none declared)
- Production artifact: (none declared)
```

Y ningún Gherkin inline. Un prompt así no le sirve a ningún agente: le pides
que implemente un requisito y no le dices contra qué.

La fila de REQ-001 en la matriz estaba **completa**. El fallo era mío, de la
PR #63: `harness/run.ts` alimenta al constructor de prompts invocando
`plan --format json` y parseando el resultado, así que los dos están acoplados
por un formato de cable. Renombré las claves a camelCase en un lado y no en el
otro.

**Por qué no falló ningún test.** El fixture de `harness-run.test.ts` estaba
escrito en snake_case y nunca se actualizó, así que fijaba una forma que `plan`
ya no produce. Un fixture a la deriva se lee como cobertura hasta el día en que
importa.

Arreglado en la PR #65: el constructor acepta ambas grafías —la del contrato
primero, la columna de la matriz como respaldo— y hay tres tests nuevos. El que
vale es el de la costura: genera un proyecto, le pide el plan al CLI real y se
lo pasa al constructor real. Ese sí lo habría cazado.

**Lo que esto dice del proyecto:** el dogfood no es ceremonia. Es el único
sitio donde apareció, porque es el único que atraviesa la costura entre dos
comandos.

---

### 11.3 El piloto estaba configurado contra algo que no existía (C8-02)

Al reconstruir el estado del piloto HIE apareció esto en su
`harness.config.yaml`:

```yaml
agent_profile: local-claude
```

Y un `.harness/profiles.yaml` con el comando del agente. **El CLI no leía
ninguna de las dos claves.** `harness run` respondía «No agent configured»
mientras el fichero declaraba uno perfectamente.

El diseño era bueno —por eso alguien lo escribió— y además resuelve la tensión
que apareció al cablear el harness del studio: o comiteas un agente por defecto
que alguien acaba pagando sin querer, o reescribes el comando en cada
ejecución. Un perfil con nombre es la tercera opción. Así que se implementó en
vez de borrarse.

**Lo importante es la otra mitad:** una clave desconocida en
`harness.config.yaml` ahora es error, con la lista de las que sí se leen.
Ignorarla en silencio es exactamente cómo un piloto acaba configurado contra
nada, y el fallo es invisible hasta que alguien ejecuta el bucle y no se cree
el mensaje de error.

Hay un test que fija los dos extremos del contrato: **toda clave que
`harness init` escribe es una clave que el lector acepta.** Sin eso, la
comprobación estricta se convierte en una trampa que tiende el propio
scaffolder.

---

---

## 12. Fase 9 — Gobierno enterprise

> Lo que una empresa exige antes de adoptar una herramienta que toca su código.

| ID | | Tarea |
|---|---|---|
| C9-01 | `[x]` | `SECURITY.md` + política de divulgación de vulnerabilidades — con *private vulnerability reporting* **activado** en el repo, para que el documento apunte a un canal que existe. Alcance explícito: packs maliciosos, traversal al renderizar, inyección de comandos, artefactos publicados y secretos de CI |
| C9-02 | `[x]` | `CODEOWNERS` + `MAINTAINERS.md` + protección de `main` — ver §12.6 |
| C9-03 | `[x]` | Integridad y firma de packs (B5) documentadas en `docs/supply-chain.md`, y **la deriva de packs entra por defecto en el gate generado**: `ci init` emite `validate --against-lock` en los cuatro proveedores, condicionado a que exista `.specops.lock`. La **firma sigue opt-in a propósito** — ver §12.4 |
| C9-04 | `[x]` | Modo offline / air-gap (B4): runbook en `docs/supply-chain.md`. Las dos vías, `CSDA_OFFLINE=1` contra caché y `pack bundle` para redes que nunca vieron el pack. Ninguna estaba documentada; `CSDA_OFFLINE` no aparecía en ningún doc |
| C9-05 | `[-]` | Telemetría opt-in. **Decidida el 2026-09-01: no se hace** ([#113](https://github.com/rsaglobaltech/specgate/issues/113) cerrada). Specgate no recoge nada — dicho en positivo, porque «aún no hay telemetría» y «esta herramienta no informa sobre ti» se leen muy distinto para quien va a meter la puerta en su CI |
| C9-06 | `[x]` | SBOM CycloneDX vía `npm sbom` (sin dependencia nueva) + `scripts/license_check.ts` como puerta de licencias, en el workflow de seguridad y como `npm run licenses`. Árbol actual: **377 componentes, todos permisivos, cero copyleft**. El gate se probó fallando, no solo pasando |
| C9-07 | `[x]` | Política de soporte y ventanas de compatibilidad en `docs/release-process.md`. **Y las ventanas ahora se aplican de verdad**: `schema_version` de `pack.yaml` y `specops_version` del lockfile se escribían y no los leía nadie — ver §12.3 |
| C9-08 | `[ ]` | Validar la guía de adopción L1–L4 (A5) con un equipo real. Trabajo de campo: no hay test que lo cierre. Va con la fase 8 |

**Estado: 6 de 8 cerradas** (C9-01, C9-02, C9-03, C9-04, C9-06, C9-07). Las dos
que quedan no dependen de escribir código: una es una decisión de producto tuya
y la otra necesita gente.

---

## 12.2 Decisión pendiente — telemetría (C9-05)

*No la implemento por mi cuenta. Recoger datos de las máquinas de otros es una
decisión de producto y de privacidad, no una tarea técnica, y el coste de
equivocarse cae sobre tu reputación, no sobre la mía.*

`risk-mitigation-plan.md` la propuso como R1 para saber qué comandos se usan de
verdad. Nunca se implementó, y el proyecto ha llegado hasta aquí sin ella.

Lo que hay que decidir antes de escribir una línea:

| Pregunta | Por qué bloquea |
|---|---|
| ¿Qué se envía exactamente? | Nombres de comandos y códigos de salida es una cosa; rutas, nombres de requisitos o contenido de specs es otra muy distinta. Un spec puede ser confidencial |
| ¿A dónde? | Un endpoint propio implica ser responsable del tratamiento. Uno de terceros implica un encargado del tratamiento y su contrato |
| ¿Opt-in u opt-out? | En herramientas de desarrollo el opt-out se percibe como traición aunque sea legal. El opt-in da menos datos y cero incidentes |
| ¿Qué dice el RGPD aquí? | Aunque no haya datos personales por diseño, hay que poder demostrarlo |

**Mi recomendación:** no hacerlo todavía. El público objetivo son equipos
enterprise, que es justo el segmento donde una llamada de red no solicitada
desde una herramienta de build es motivo de veto — y ya hay una vía sin ese
coste, `csda report` y `plan --json`, que dejan los datos en manos del equipo
que los genera. Si algún día hace falta, que sea opt-in explícito y con la
lista de campos publicada en `docs/`.

---

## 12.3 Dos campos de versión que nadie leía (C9-07)

Al ir a escribir la política de compatibilidad apareció el problema de fondo:
**los dos campos existían y no los leía nadie.**

- `pack.yaml` → `schema_version`. Lo escribe `pack init`, lo valida el JSON
  schema *como formato* (`^\d+\.\d+\.\d+$`) y ahí acababa todo. Un pack escrito
  contra un schema más nuevo fallaba después con `unknown property X` — cierto
  y completamente inútil para deducir que el CLI se había quedado corto.
- `.specops.lock` → `specops_version`. Se escribe desde el primer lockfile y no
  se leía jamás. Un lockfile de un CLI más nuevo se aceptaba en silencio y
  luego se malinterpretaba campo a campo.

Escribir una política de ventanas de compatibilidad sobre eso habría sido
exactamente el defecto que persigue la fase 1: un documento que afirma una
garantía que el código no da. Así que se implementaron las dos puertas.

**Solo se rechaza lo más nuevo que el CLI.** Un pack con schema viejo, o un
lockfile sin `specops_version`, siguen funcionando: esos ficheros son
anteriores al campo y rechazarlos sería dejar tirados a proyectos existentes
para aplicar una regla inventada después.

**Orden de release al subir el schema de packs:** primero el CLI que lo
entiende, después los packs que lo usan. Al revés, los diez packs curados (más
el de ejemplo `sample-contracts`, el único ya en `1.2.0`) se vuelven
ininstalables con el CLI publicado. Hay un test que recorre `packs/` y lo
comprueba, así que equivocarse de orden rompe CI y no a los usuarios.

---

## 12.4 Por qué la firma de packs sigue siendo opt-in (C9-03)

El plan decía «activarla por defecto en CI». Al implementarlo resultó ser la
decisión equivocada, así que se hizo la mitad que sí procede y se documentó por
qué la otra no.

**Lo que sí pasa a estar activo por defecto:** la deriva de packs.
`csda ci init` emite ahora `validate --against-lock` en GitHub, GitLab, Azure y
Jenkins, protegido con `if [ -f .specops.lock ]` para que un proyecto sin packs
no vea ningún cambio. Esto no rompe a nadie: si tienes lockfile, la
comprobación es exactamente lo que querías.

**Lo que no:** `require_signed_packs: true` por defecto rompería a todo
proyecto que instale un pack cuyos tags no estén firmados — **incluidos los
diez packs curados de este mismo repositorio**. Un default que falla con un uso
correcto enseña a la gente a desactivar la comprobación, y eso es peor que no
tenerla. Se activa cuando tu organización firma sus propios packs, que es
cuando el chequeo empieza a distinguir algo.

Si algún día se firman los packs curados, la decisión se puede revisar.

---

## 12.6 Gobierno de `main` (C9-02)

*Decidido el 2026-08-16, al pasar a trabajar con ramas cortas.*

A partir de aquí cada unidad de trabajo va en su rama con PR. `main` está
protegida: nada de push directo, ni forzado, ni borrado, y los 12 checks de CI
son obligatorios con `strict` (la rama tiene que estar al día antes de mergear).
Esto último se comprobó en caliente: el PR #52 fue **rechazado** por no estar al
día y hubo que actualizarlo.

**Con una excepción que conviene escribir en vez de dejar implícita:**
`enforce_admins` está en `false`, así que un administrador del repo **sí** puede
empujar directo a `main`. Comprobado, no supuesto — un commit de prueba enviado
a pelo entró sin ser rechazado. Ese commit (`7ae3adf`, vacío) sigue en `main`:
revertir un commit vacío solo añade otro commit vacío, y el force-push para
quitarlo se bloqueó, con buen criterio, por ser una reescritura destructiva de
una rama pública.

Es una salida de emergencia, no una puerta de uso diario. Activar
`enforce_admins` dejaría al único mantenedor encerrado fuera de su propia vía de
recuperación; se revisa junto con las revisiones obligatorias cuando entre un
segundo mantenedor.

**Las revisiones aprobatorias están deliberadamente desactivadas.** Con un solo
mantenedor, exigir una aprobación significa que nadie puede mergear nada —
GitHub no deja aprobar tu propio PR. La puerta que de verdad protege `main` aquí
es la suite, y esa sí es obligatoria. Cuando entre un segundo mantenedor se
activan las revisiones y se borra este párrafo; está anotado igual en
`MAINTAINERS.md` y en `CONTRIBUTING.md` para que la excepción no se lea como
descuido.

Lo que se exige está en la tabla de *Required checks* de `CONTRIBUTING.md`, que
es la lista real y no una copia que se desincroniza.

---

## 12.5 Fase 7.5 — `mobile` como tipo de proyecto de primera clase

*Decidido el 2026-08-16, tras comprobar que hoy hay que mentir en `PROJECT_TYPE`
para montar una app móvil. Se hace **después de la fase 7**, con el CLI ya
publicado.*

Hoy una app móvil funciona con `PROJECT_TYPE: frontend` y el `STACK` bien
puesto — el stack nunca está hardcodeado y todo el núcleo es agnóstico. Lo que
falla es el vocabulario y la honestidad del tipo declarado.

| ID | | Tarea | Detalle |
|---|---|---|---|
| C75-01 | `[x]` | `mobile` en el enum de `PROJECT_TYPE` | `scripts/init_project.ts`. Hoy solo acepta `backend\|frontend`, así que el tipo declarado en `spec.md` miente |
| C75-02 | `[x]` | `templates/mobile/` con su propio `AI_RULES.md.tpl` | El de frontend habla vocabulario web: *responsive behavior*, *componentization*. Lo que necesita un equipo móvil: offline-first, paridad iOS/Android, ciclo background/foreground, deep links, permisos, y que una release pasa por revisión de store — lo cual cambia qué significa «hecho». `templates/frontend/` son 2 ficheros; este será igual de pequeño |
| C75-03 | `[x]` | `mobile` en `schemas/pack.schema.json` y en `pack init --type` | Para que existan packs de dominio móvil |
| C75-04 | `[x]` | Escenario base móvil en vez del `health.feature` web | Un smoke de arranque de app, no un endpoint HTTP |

**Cerrada el 2026-08-17.** `mobile` es tipo de primera clase en las cuatro
puertas: el enum de `init`, las opciones del wizard, `pack init --type` y el
enum del `schemas/pack.schema.json` (más el validador, que ya se alineó con el
esquema en ADR-0020).

`templates/mobile/AI_RULES.md.tpl` **no es una copia del de frontend**. Lo que
cambia es lo que un equipo móvil se juega, y cada punto es criterio de
aceptación, no consejo: offline como estado y no como error, que el SO puede
matar el proceso en cualquier momento, paridad iOS/Android declarada en vez de
supuesta, permisos como flujo **con rama de denegación**, deep links como
puntos de entrada en frío, y que **la revisión de store es parte de «hecho»**.

El escenario base pasa de «navego a la ruta `/`» a un arranque en frío que no
requiere red.

**Hay un test que fija los cuatro sitios juntos.** Un tipo aceptado por uno y
rechazado por otro es exactamente cómo `contracts` acabó siendo generable e
imposible de instalar; ahora eso rompe CI.

**Dos tests existentes usaban `mobile` como ejemplo de tipo inválido.** Fallaron,
con razón, y se actualizaron a `desktop`. Vale la pena notarlo: la suite tenía
escrito «móvil no se soporta» como aserción.

**No hice un cambio que parecía tocar:** el `docker-compose.yml` que se genera
es el contenedor de *devcontainer*, no un servidor de aplicación, así que es
legítimo para un proyecto móvil y lo controla `DOCKER_SUPPORT`. Arreglar algo
que no está roto también es un defecto.

**Ya resuelto por adelantado (fase 5):** el contrato de runtime documentaba
Postgres para todo proyecto, incluido frontend web. Ahora hay `DATASTORE`
(`postgres` \| `none`, por defecto según `PROJECT_TYPE`), y sin datastore no se
generan variables `DATABASE_*`, ni sección de base de datos en el spec, ni
servicio `db` en compose. Eso era el 80 % de la fricción del caso móvil, y
además arreglaba frontend web, que estaba mal desde el principio.

---

## 12.9 Limpieza documental (2026-08-16)

Ocho documentos eliminados y uno recortado. Todos describían un pasado
terminado con la forma de un plan — exactamente el defecto que las fases 1 y 2
corrigieron en los demás. Siguen en el historial de git; lo que se ha quitado
es su presencia en el árbol, donde se leen como si estuvieran vigentes.

| Eliminado | Por qué |
|---|---|
| `IMPROVEMENTS.md` (206 l.) | Backlog de `v0.1.0-beta.3`. Prácticamente todo implementado; sus items de shell/Bats son irrelevantes desde ADR-0008 |
| `PROJECT_REPORT.md` (419 l.) | Overview de mayo. README (121 l.), `comparisons.md` y `architecture.md` cubren su terreno; su §9 Roadmap estaba obsoleto |
| `mejoras/implementation-roadmap.md` (923 l.) | «31/31 pasos completos». Sus 7 items diferidos de §8 viven ahora en este plan |
| `mejoras/risk-mitigation-plan.md` (390 l.) | R1–R4: entregado, o en el backlog aparcado de §13 |
| `mejoras/enterprise-adoption-plan.md` (359 l.) | A1–A6 y B1–B8 mergeados en C0-05. Cero referencias entrantes |
| `mejoras/visual-pack-authoring-todo.md` (224 l.) | Fases 1–3 hechas; la 4 la cerró ADR-0019 |
| `reports/mutation/pilot-results.md` + `README.md` (129 l.) | Resultados de mayo contra `scripts/domain-pack/common.js`, fichero que ya no existe |

**Recortado:** `mejoras/openspec-benchmark-plan.md`, de 768 a 413 líneas. Se
eliminó el plan por fases, el diseño técnico y el checklist —ejecutados como
fases 3, 4 y 5— y se conservó lo que no caduca: qué es OpenSpec, la comparativa,
la valoración de SpecOps y qué decidimos no copiar. `docs/comparisons.md` lo
cita como la evidencia de su columna de OpenSpec, así que borrarlo entero habría
dejado sin respaldo una afirmación pública.

**Conservado a propósito:** los tres documentos de `csda-studio` (1540 líneas).
C8-01 es trabajo vivo y el runbook es la guía para retomarlo; borrarlos habría
cerrado la fase 8 de facto sin decidirlo.

Las citas que quedaban en ADR-0014 y ADR-0019 se anotaron en vez de borrarse:
un ADR es registro permanente, y una cita que el lector no puede seguir es peor
que ninguna.

---

## 12.8 Aplazado por decisión — publicar plugins y registry (D9)

> **Decidido el 2026-08-17: aplazado, no descartado.** Publicar los plugins,
> la extensión y el registry no es una prioridad ahora. Las tareas quedan
> marcadas `[-]` con este motivo, y las credenciales siguen siendo el único
> bloqueo técnico cuando se retomen.

Nada de esto está empezado, y nada de esto bloquea al resto del proyecto: el
CLI se publica en npm y la imagen en ghcr, que son las dos vías que un equipo
usa de verdad hoy. Los plugins de Maven y Gradle **se construyen y sus tests
corren en CI**; lo único que falta es empujarlos a un registro.

Cuando se retome, para cada destino puedo dejar el workflow y el paso a paso
listos, de modo que solo haya que añadir el secreto y lanzarlo.

| ID | Destino | Qué hace falta |
|---|---|---|
| C7-05 | Maven Central | Cuenta OSSRH (o Nexus interno), `groupId` verificado y clave GPG para firmar. No existe workflow todavía |
| C7-06 | Gradle Plugin Portal | Key y secret del Portal, o un repositorio interno. Tampoco existe workflow |
| C7-07 | VS Code Marketplace | Cuenta de *publisher* en Azure DevOps y un PAT. El `.vsix` ya se construye; falta el `vsce publish` |
| C7-08 | npm scope `@spec-driven` | El scope **no existe** en npm. Hay que crearlo (gratis para paquetes públicos) antes de poder publicar `mcp-server` y `lsp-server` |
| C7-09 | `packs.spec-driven.dev` | El dominio, y la variable de repositorio `SITE_CNAME`. `gh-pages` ya publica correctamente sin él |

> **Nota sobre C7-08:** los dos paquetes ya empaquetan bien —se arregló en
> C6-03— así que el único bloqueo es que el scope no existe.

---

## 12.7 Decisión pendiente — dos majors bloqueados por el suelo de plataforma

*Abierta el 2026-08-16, al triar los 10 PRs de Dependabot. Ninguno de los dos es
un problema del bump: los dos preguntan hasta dónde soportamos runtimes viejos.*

Ambos están cerrados en GitHub con el motivo escrito en el PR e ignorados para
majors en `.github/dependabot.yml`, con el comentario que dice qué los
desbloquea. Se quita la entrada de `ignore` cuando se decida.

| PR | Bump | Por qué rompe | Qué lo desbloquea |
|---|---|---|---|
| #45 | `@cucumber/cucumber` 12 → 13 | **Resuelto el 2026-08-17**: el suelo subió a Node 22 y la major entró. La suite BDD pasa sin tocar nada | — |
| #36 | `org.junit:junit-bom` 5 → 6 | JUnit 6 publica solo variante Java 17. El plugin de Gradle compila a Java 11 a propósito, así que Gradle ni resuelve: *«No matching variant … this component declares a component, compatible with Java 17 and the consumer needed a component, compatible with Java 11»* | Subir el objetivo del plugin a Java 17 |

**La primera está resuelta.** Node 20 salió de mantenimiento LTS en abril de
2026, así que la matriz probaba contra un runtime sin soporte. El 2026-08-17 el
suelo subió a **Node 22** (matriz 22 y 24), `cucumber 13` entró, y la política
quedó escrita: *el suelo es una LTS mantenida; cuando una sale de
mantenimiento, el suelo se mueve en la siguiente release*. Hay un test que
sujeta las doce declaraciones de versión juntas — habían derivado antes, con los
paquetes publicables diciendo `>=18` mientras el CLI exigía 20.

**La segunda tiene menos margen:** Java 11 en los plugins de Maven y Gradle es
la razón de que existan. Un agente de build corporativo es exactamente el sitio
donde no puedes elegir la JDK. Subir a 17 se lleva por delante ese caso de uso.

---

## 12.10 Camino a 1.0 — el gate, no una fecha

*Escrito el 2026-08-17, con los números medidos, no recordados.*

**Lo que 1.0 significa aquí:** que el formato de packs y el contrato de agente
son estables, y que la política de soporte deja de decir «intención» y pasa a
decir «promesa». Eso es lo que compra un equipo cuando ve un 1.0.

### Lo que ya está listo

| | Medido |
|---|---|
| Tests | 658, 0 fallos |
| Cobertura | 77,24 líneas · 73,62 ramas · 83,22 funciones |
| Checks obligatorios | 13, sobre matriz 3 SO × 2 Node |
| Superficie visible | 9 comandos; 32 en total tras `--help --all` |
| Packs curados | 11, y **un test instala cada uno** |
| ADRs | 20 |
| Distribución | npm con procedencia SLSA + imagen multi-arch, verificadas desde cero |
| Gobierno | `SECURITY.md`, `CODEOWNERS`, `MAINTAINERS.md`, SBOM, puerta de licencias, `main` protegida |

### Lo que falta, y es medible

**G1 · Dos releases de features seguidas sin breaking.** ✅ **Cumplido el
2026-08-18.** 0.5.0 y 0.6.0, ambas con cero breaking. El histórico: 0.2.0 tuvo
2, 0.3.0 tuvo 1, 0.4.0 tuvo 1 (el suelo de Node), y luego dos limpias.

Matiz honesto: las dos limpias son **releases de arreglos**, no de features
nuevas. Son siete y ocho entradas de `Fixed` salidas de ejecutar el harness. Que
no rompan nada era casi inevitable — arreglar no suele romper contrato. La
prueba de verdad llega con la siguiente release que **añada** algo.

**Ese matiz también se cumplió — comprobado el 2026-08-26.** **0.7.0** (2026-08-23)
es la release aditiva que el párrafo anterior reclamaba: seis flags nuevos
(`--strict-scenarios`, `--skip-not-ready`, `--resume`, `--budget-seconds`,
`--max-requirements`, `--strict-artifacts`) más la guardia de alcance de escritura,
y **sin sección `⚠️ Breaking`**. En todo el `CHANGELOG.md` esa sección solo aparece
en 0.2.0, 0.3.0 y 0.4.0: llevamos **tres** releases limpias seguidas, la última
grande y aditiva. G1 deja de tener asterisco.

**G2 · El bucle del harness completado de punta a punta al menos una vez.**
✅ **Hecho el 2026-08-17** con Claude como agente, sobre REQ-001 de
`csda-studio-app`. El agente escribió 18 ficheros respetando las capas
hexagonales, sin tocar `features/**/*.feature` ni `docs/specs/**`. Escenario
verde, sin regresiones, verificado a mano. Rama `harness/REQ-001` en PR #1 del
repo del studio, sin mergear — el harness nunca mergea.

**Y fue la tarea más rentable del plan.** Una sola ejecución destapó tres
defectos que no se veían leyendo el código, todos en 0.5.0:

1. **El gate no ejecutaba el escenario que supervisaba.** `test_cmd` no admitía
   sustitución, y el gate corre *antes* de `csda done`, así que el requisito
   sigue en `Draft` y `--strict-tdd` tampoco exige su test. El bucle podía
   declarar «Implemented» sin haber ejecutado el escenario nunca. Que REQ-001
   saliera bien fue el agente haciéndolo bien, no el gate comprobándolo.
2. **El harness se bloqueaba a sí mismo**: archivaba los prompts en el
   directorio del proyecto, ensuciando el árbol, y se niega a arrancar con el
   árbol sucio.
3. **Un test tapaba el segundo**, filtrando `.specops/` de su comprobación de
   árbol limpio para poder pasar.

Lección para el resto del plan: los defectos de este tipo solo aparecen
ejecutando. Si una ejecución encontró tres, catorce encontrarán más — que es
precisamente el argumento de G1.

**G3 · Un equipo de fuera adopta en L1–L2 y reporta.** Es C9-08. La estabilidad
de una API no se decide leyéndola; nadie ajeno a este repo la ha usado todavía.

**G4 · El gate de cobertura sube a lo que ya es.** ✅ **Hecho el 2026-08-17**:
declaraba 74/70/80 con la realidad en 77/73/83, así que la cobertura podía caer
tres puntos sin que nada protestara. Ahora 76/72/82 — un punto de holgura, para
que un refactor ajeno no lo dispare pero una regresión real sí.

**G5 · La política de soporte se escribe sin la frase que la anula.**
✅ **Cumplido el 2026-08-26.** La cláusula de escape ya no está en
`docs/release-process.md`, y con ella se acepta el compromiso: una línea
soportada más el minor anterior **seis meses** desde que sale su sucesor,
arreglos de seguridad y de corrección, features no.

Se escribió también lo que cuesta —dos líneas con camino de release durante seis
meses tras cada minor, y cada fix evaluado contra el minor anterior— porque una
promesa que nadie costeó es exactamente cómo el párrafo acabó necesitando una
cláusula de escape la primera vez. Si deja de ser sostenible, se cambia el
párrafo en una release y se dice bajo Breaking; no se deja de cumplir en
silencio.

**Y salió una mentira documental al tirar del hilo:** `SECURITY.md` declaraba
`0.2.x` como única versión soportada — **cinco minors tarde**, sin que nadie lo
revisara desde que se escribió. Corregido a `0.7.x`, con la nota de que la tabla
se mueve con la release o se convierte en la clase de afirmación que existe para
evitar.

### Fuera del alcance de 1.0

Publicar los plugins de Maven y Gradle, la extensión de VS Code, el scope npm y
el registry (D12). Son otro producto, con otras credenciales y otro ciclo. Van a
**v2**.

### Lectura honesta del calendario

G1 depende de que pase el tiempo sin romper nada, así que **no se puede
acelerar**. G2 y G3 dependen de gente y de un agente. Ninguno de los cinco
depende de escribir más código, salvo G4, que es una línea.

Dicho de otro modo: 1.0 no está a X tareas de distancia, está a **dos releases
tranquilas y un usuario real** de distancia.

**Actualización 2026-08-25 — se cambia el orden (D14).** Se decide anteponer el
cierre del hueco de verificación (ver `PLAN_PREDICTABLE_CODE_EVOLUTION.md`) a los
gates que quedan. Coste explícito, para no reabrir esto por olvido:

- **1.0 se retrasa.** `GATE-G3` y `GATE-G5` siguen exactamente como estaban —
  abiertos, sin código pendiente— pero dejan de ser lo próximo que se ataca.
- **`GATE-G1` se pone a prueba con la release más grande que ha tenido el
  proyecto.** G1 se cumplió con 0.5.0 y 0.6.0, y el propio matiz de la sección
  ya lo advertía: *"las dos limpias son releases de arreglos […] la prueba de
  verdad llega con la siguiente release que añada algo"*. La primera release
  aditiva del proyecto es también, con este cambio, la de mayor alcance —
  justo el escenario que G1 existía para medir, ahora sin el colchón de haber
  visto antes una release aditiva pequeña pasar limpia.
- El argumento de venta pasa, para esta fase, de la estabilidad a la
  verificación. No se borra el texto anterior de esta sección — sigue siendo
  cierto sobre lo medido hasta el 2026-08-17. Se fecha esta actualización para
  que quede claro qué se sabía cuándo.

---

## 12.11 El harness en producción — defectos encontrados ejecutándolo

*Abierto el 2026-08-17. Dos ejecuciones reales con Claude como agente, sobre
REQ-001 y REQ-002 de `csda-studio-app`. Nada de esto se veía leyendo el código.*

**Regla que sale de aquí:** el harness solo revela sus defectos cuando corre con
un agente de verdad. Ninguna revisión estática los habría encontrado, y cada uno
habría llegado al 1.0.

### Cerrados

| # | Defecto | Por qué importaba |
|---|---|---|
| H1 | **El gate no ejecutaba el escenario que supervisaba.** `test_cmd` no admitía sustitución, y el gate corre *antes* de `csda done`, así que el requisito sigue `Draft` y `--strict-tdd` tampoco exige su test | El bucle podía declarar «Implemented» sin ejecutar el escenario. Que REQ-001 saliera bien fue el agente, no el gate. **Es la negación del producto** |
| H2 | **El harness se bloqueaba a sí mismo**: archivaba prompts en el directorio del proyecto, y se niega a arrancar con el árbol sucio | La segunda ejecución fallaba por la basura de la primera |
| H3 | **Un test tapaba H2**, filtrando `.specops/` de su comprobación de árbol limpio para poder pasar | Una aserción debilitada para pasar es peor que ninguna |
| H4 | **El reporte tiraba el diagnóstico que ya tenía.** La salida completa del gate se capturaba y se reducía a `split("\n")[0]` | Un fallo decía `Gate failed at: test command` y nada más. Costó una segunda ejecución de 15 min de agente para ver lo que la primera ya sabía |
| H5 | **El trabajo del agente se destruía al fallar el gate.** Sin commit y worktree borrado: la rama quedaba idéntica a su base | Un fallo no dejaba nada que revisar. Ahora se comitea con asunto `wip(REQ-NNN): FAILED the gate` y el requisito sigue `Draft` |
| H6 | **El gate no decía qué comando había corrido** | Un gate que hace lo incorrecto en silencio falla igual que uno legítimo. Es lo que hizo que el fallo falso de REQ-002 costara dos ejecuciones |
| H7 | **Timeout por defecto de 600 s** | Desmentido por las dos ejecuciones: el primer intento de REQ-001 llegó a 900 s instalando dependencias y trabajando. Un default que caduca con trabajo normal convierte todo primer intento en desperdicio. Ahora 1200 |
| H8 | **Un worktree nuevo no tiene `node_modules`** — solo lleva lo que git rastrea | No es cambio de código: la plantilla generada ahora lo dice y pone `npm ci &&` delante del gate |
| H10 | **Nada avisaba de un gate mal configurado.** Si el filtro no filtra, el gate corre la suite entera y rechaza trabajo correcto | El harness no puede saber cuántos tests *debería* haber, pero sí nota un comando que pidió **un** feature contra una salida que habla de muchos. Avisa, no dictamina — un fallo legítimo no debe convertirse en «será config» |
| H11 | **El agente no podía escribir** en modo no interactivo, y no había dónde enterarse | Un agente con `-p` no puede pedir permiso: sin `--allowedTools` lee el prompt, no puede escribir, y el intento se pierde. Documentado en `docs/automation.md` con alcance (`Bash(npm:*)`) en vez de saltarse permisos |
| H14 | **27 de los 28 escenarios de los packs curados tenían cero pasos para Cucumber.** Las plantillas escribían `GIVEN`/`WHEN`/`THEN` en mayúsculas y las palabras clave de Gherkin son sensibles a mayúsculas: el parser real las absorbía como descripción. **Cerrado el 2026-08-22 por `F2`**: los 27 ficheros pasan a la forma canónica y `tests/unit/shipped-gherkin.test.ts` parsea con `@cucumber/gherkin` cada `.feature` y `.feature.tpl` que se publica, fallando si un escenario tiene cero pasos | Medido antes y después sobre el mismo fichero: `0 steps · exit 0` → `3 steps · exit 1`. El linter propio seguía aprobándolos porque su matcher es insensible a mayúsculas — eso es `F3` |
| H12 | **Requisitos dependientes no se expresan.** REQ-002 se apoya en REQ-001 y había que saberlo y pasar `--base-branch` a mano. Cerrado el 2026-08-20 por `E1-01`: el requisito declara `depends=REQ-NNN` en su comentario `csda:trace`, `plan` ordena la cola topológicamente y marca lo bloqueado, y `validate` falla ciclos, dependencias inexistentes y autorreferencias | Sin esto, `harness run` sin `--req` procesaba en orden de matriz y fallaba en cascada. Ver `mejoras/escalado-multiagente-conectores.md` |
| H9 | **`--base-branch` heredaba la configuración de la base, no la de `main`.** Cerrado el 2026-08-20 por `E1-03`: la base se **deriva** del grafo (la rama de la dependencia, o la integración de varias), así que ya no se pasa a mano, y el harness avisa cuando esa base va por detrás de la línea principal, diciendo cuántos commits | Es correcto —así funciona git— pero costó dos ejecuciones de agente: el fallo falso de REQ-002 fue exactamente esto |
| H13 | **El JSON Schema no lo aplica nadie.** ADR-0020 lo declaró «única autoridad», pero el CLI no valida contra él: es una pista `$schema` para el editor y un test contra un fixture. Los once packs curados **fallarían** el esquema — sus `aggregates` usan `bounded_context`/`responsibilities` donde el esquema exige `context`/`invariants`, y `additionalProperties: false` prohíbe los extras. Lo que sí se comprueba es `validatePackModel` + las once reglas de `pack lint`, que son reales y sustanciales **Cerrado el 2026-08-23 por 0.7.0** — `schemas/pack.schema.json` pasa a 1.3.0 y describe el formato que **existe**; los once packs curados dejan de fallar el esquema que ADR-0020 llama autoridad, y el renderer deja de producir documentos de dominio vacíos | Descubierto al documentar el modelo DDD para el artículo. Se eligió la primera de las dos salidas —aplicar el esquema de verdad— porque la situación de entonces era la peor de las tres: **afirmaba una autoridad que no ejercía** |
| H15 | **Un filtro de escenario que no casa nada sale 0.** `cucumber-js --tags "@NO-EXISTE"` devuelve «0 scenarios» y exit 0. Si el agente renombra el escenario, `{scenario}` deja de casar y el gate va verde sin ejecutar nada **Cerrado el 2026-08-23 por 0.7.0** — el filtro de escenario deja de aprobar una cuenta de cero | Anotado el 2026-08-22. `filterHint` solo avisaba cuando contaba **de más**, nunca cuando contaba cero, y con una expresión regular sobre prosa. La salida limpia sigue siendo el protocolo de mensajes de Cucumber —propuesta F5, aún sin hacer—: 0.7.0 cierra el agujero, no la fragilidad del método |
| H16 | **El gate no comprueba que el agente no tocó `spec.md`, `AI_RULES.md` ni `features/**`.** El prompt se lo prohíbe; nada lo verifica. El agente tiene permiso de escritura sobre el fichero que define su propio criterio de éxito **Cerrado el 2026-08-23 por 0.7.0** — hay guardia de alcance de escritura antes del gate: `spec.md`, `AI_RULES.md`, `features/**`, `docs/specs/**`, `.specops.lock` y `harness.config.yaml`, configurable con `protected_paths` / `allow_paths` | Anotado el 2026-08-22. `validate --strict-tdd` comprueba que el feature exista, no que diga lo mismo que antes; por eso hizo falta una guardia aparte. Era la propuesta A1 de `propuesta-harness-planificacion.md` |
| H19 | **Sin `test_cmd`, el gate no comprueba que los artefactos existan.** Un agente que no escribe nada pasa `validate --strict-tdd` y el requisito se marca Implemented **Cerrado el 2026-08-26.** Reproducido con `--agent "cat {prompt_file} > /dev/null"` sobre un proyecto recién generado: `✅ REQ-000 pass (1 attempt)`, fila a `Implemented`, Test artifact en `TBD`, cero ficheros. El harness rechaza ahora un intento con diff vacío, **antes** del gate, en una etapa propia `no-op`. Predicado puro en `packages/core/src/domain/EmptyAttempt.ts` con 7 tests. [PR #133](https://github.com/rsaglobaltech/specgate/pull/133), apilado sobre #132. **Y la suite afirmaba el defecto**: 17 tests usaban un agente que no escribe nada como «agente cuyo trabajo pasa el gate» — H3 por segunda vez | Encontrado el 2026-08-20 probando `E1-02` con un agente vacío. Es de la familia de H1: el gate no verifica lo que dice verificar. Pre-existente, sin arreglar |
| H20 | **Un proyecto recién generado no pasa su propio `validate --strict-tdd`.** `csda init --yes` escribe en `spec.md` un `REQ-001` de plantilla («Describe the first business requirement») que no tiene fila en `docs/specs/traceability.md`, así que `[TDD-3]` dispara desde el minuto cero **Cerrado el 2026-08-26**, el mismo día. La fila de ejemplo sale de `templates/base/spec.md.tpl` §8 y la sustituye un comentario que remite a `csda req add`, que escribe en `spec.md` **y** en la matriz a la vez. `ensureTraceabilityCoverage` no podía salvarlo: reconcilia feature files sin fila, no requisitos | Encontrado el 2026-08-26 montando el fixture de H19. Peor de lo que parece: `harness run` sobre un proyecto nuevo **quema los tres intentos del agente** fallando por algo que el agente no causó ni puede arreglar. Y contradice el nivel L2 de adopción del README —«a PR gate enforcing spec and test coverage, ~1 hour»—: la puerta está roja antes de escribir nada. Fijado por un test que corre las **cuatro** puertas sobre un proyecto recién generado — el defecto era invisible desde dentro, porque el `validate` a secas estaba verde |
| H21 | **El piloto de mutación medía un shim y lo llamaba «mutation score».** `6ada847` disolvió los re-export shims: `dist/scripts/domain-pack/common.js` dejó de existir y `dist/scripts/change/delta.js` quedó en 19 líneas de re-exports. `stryker.config.mjs` no se actualizó, y **Stryker solo avisa** ante un glob que no casa nada. Resultado: 4 mutantes, uno de los dos objetivos ausente, y verde cada lunes. **Cerrado el 2026-08-26** — objetivos a `PackSpec.js` y `DeltaSpec.js`, y `mutation:pilot` falla ahora si un objetivo no existe **o es demasiado pequeño para no ser un shim** | Encontrado tirando del hilo de #125, que bumpea Stryker a 10.0.0. Es H15 otra vez —un filtro que no casa nada y reporta éxito—, y el tercer caso del día. El número que el plan daba por bueno llevaba meses siendo falso: **55,14 % sobre 749 mutantes** con Stryker 10, no 51,32 % sobre 4 |
| H22 | **`req add` reemite un id que `adopt` ya sembró, y `req link` escribe entonces las dos filas.** `parseTraceabilityRows` deduplicaba con clave `featureFile::scenarioId`; las filas de propuesta de `adopt` no tienen ninguno de los dos, así que todas colapsaban en `-::-` y el asignador veía un máximo corto. El fichero conservaba las filas — solo la *lectura* era corta. Enlazar un requisito nuevo reapuntaba en silencio el sembrado: en PetClinic, el requisito «Vet» acabó declarando `PetValidator.java` como implementación y `PetValidatorTests.java` como prueba, ambas falsas. **Cerrado el 2026-09-01** (`ffa0f9c`): la identidad de una fila incluye su requisito | **Las tres empresas de la ronda 1 de GATE-G6, en tres stacks distintos, en los primeros cinco minutos**, usando solo los comandos que la herramienta les imprimió. Regla de la fase 3: si sale en las tres, es de la herramienta |
| H23 | **`validate` aprobaba una matriz con id de requisito duplicado.** Con las cuatro puertas estrictas a la vez, salida 0. Cazaba escenarios duplicados y no requisitos — que son la clave primaria de la tabla, y lo que `done`, `req link` y `plan` usan para direccionar una fila. No es un enlace roto, es una tabla rota, y la puerta que existe para cazar enlaces rotos estaba verde. **Cerrado el 2026-09-01** (`ffa0f9c`): `duplicate_requirement_id`, sin flag para activarlo | Familia de H1/H15/H19: la puerta no verifica lo que dice verificar. Cuarto caso |
| H24 | **La puerta generada no corría la comprobación que su propio comentario promete.** `ci init` escribe «no PR merges if a requirement loses its feature file, **its test artifact**, or its traceability row» y ejecutaba `validate . --strict-tdd`, que no toca el disco. Enlazar un test, borrarlo y correr el comando exacto del workflow: `✅ Validation passed`. `--strict-links` existe y sale con 1 — no estaba en el fichero, en ninguno de los cuatro proveedores. La documentación tenía el extremo débil de la misma contradicción, y el hook de `automation.md` fijaba `@0.1.0`, anterior al renombrado. **Cerrado el 2026-09-01** (`19a15bc`) | Dos de las tres empresas, por separado, en proveedores de CI distintos |
| H25 | **La puerta protege la especificación pero no su propio comando.** `DEFAULT_PROTECTED_PATHS` cubre `spec.md`, `AI_RULES.md`, `features/**` y `docs/specs/**` — el contrato. No cubre el fichero donde vive el comando que la puerta ejecuta. Reproducido con un agente stub que **no escribe una línea de implementación** y solo cambia `"test"` a `echo 'all good'` en `package.json`, sobre una suite en rojo: `✅ REQ-001 pass (1 attempt)`. El que no consigue pasar el test puede debilitar el test, que es A1 exactamente, un nivel más arriba | Encontrado en el spike de #105 por accidente: el comando de test del fixture estaba roto y el agente real lo arregló para pasar. El arreglo era correcto; el que **pudiera** hacerlo no. Repro: `mejoras/spike-105-evidence/repro-gate-command-unprotected.sh`. **Cerrado el 2026-09-02**: no se protege el manifiesto —eso bloquearía añadir una dependencia y el guard acabaría desactivado—, se compara **un valor**, el script que el comando de la puerta invoca, antes y después. `npm`/`yarn`/`pnpm`/`make` resuelven a algo legible; `mvn`, `pytest` y `go test` no, y ahí el check declara que **no miró**, nunca que aprobó |
| H26 | **Un escenario declarado que nadie prueba pasa todas las puertas.** `--strict-scenarios` mide la *calidad* del Gherkin —When, Then, tres pasos—, nunca su *cobertura*, y la matriz nombra un `Scenario ID` por fila para un fichero que puede contener cinco. Reproducido sin agente: feature con tres escenarios, tests que cubren dos, fila en `Implemented`, y `validate` con `--strict-tdd --strict-scenarios --strict-links` sale 0 | Encontrado en el spike de #105 forzando un fallo: el agente escribió tests para cuatro de cinco escenarios y **omitió el que no podía satisfacer**, y la puerta aprobó. Coincide con lo que `nimbus-billing` reportó por otra vía: la web afirma «scenarios must actually execute». Repro: `mejoras/spike-105-evidence/repro-uncovered-scenario.sh`. **Cerrado el 2026-09-02** con `--strict-coverage`, bandera propia y no dentro de `--strict-tdd`: es una coincidencia de nombre, no ejecuta la suite, así que un proyecto que nombre sus tests de otra forma no empieza a fallar porque salió una versión. Casa el tag `@SCN-NNN`, el id del título, o el título |

### Los arreglos se probaron solos, en producción

La tercera ejecución de REQ-002 falló por algo que no era ni el harness ni el
agente: **la cuenta de Claude agotó su límite mensual de gasto**. Y ahí se vio
el valor de H4 y H5 sin necesidad de inventar un caso:

```
❌ REQ-002  fail (2 attempts)  → harness/REQ-002
     Agent exited 1.
     │ You've hit your monthly spend limit · raise it at claude.ai/settings/usage
     └ full output: --format json · reproduce: --keep-worktrees
     ↳ the attempt is committed on harness/REQ-002 — review it
```

Antes de los arreglos, eso habría sido `Agent exited 1` a secas, y **861 líneas
que el agente sí escribió** se habrían borrado con el worktree. Ahora la causa
está en pantalla y el trabajo está en la rama.

**Una advertencia metodológica, por honestidad:** reconstruí `dist/` mientras
dos de estas ejecuciones estaban en marcha, así que sus procesos posteriores
recogieron código nuevo a media ejecución. No invalida los hallazgos —cada uno
se reprodujo después— pero es una forma sucia de medir y no debería repetirse.

### La puerta de entrada brownfield, arreglada (2026-08-18)

*Los cuatro salieron de ejecutar el CLI contra `lakebase-platform` y
`lixi-platform`. Ninguno se veía leyendo el código, y los cuatro estaban en la
primera pantalla que ve alguien que llega con un repo Java.*

| # | Defecto | Nota | Estado |
|---|---|---|---|
| H16 | **`onboard` se escapa al proyecto padre desde un subproyecto.** En `lixi-platform/lixy-api/` (299 ficheros Java, sin adoptar) responde con la ruta, el stack y las capacidades del **repo padre** — Node/TypeScript, y encima «✔ already adopted». `resolveProjectDir` sube buscando `spec.md` y encuentra el del ancestro | En la misma carpeta `csda adopt` **sí** acierta el stack Java: dos comandos discrepan sobre en qué proyecto estás. Analizar otro proyecto en silencio es peor que fallar. `onboard` corre por definición sobre repos aún no adoptados: no debería resolver hacia arriba, o debe decir en voz alta que subió | **Cerrado** |
| H17 | **Cero capacidades sobre un proyecto Java hexagonal.** `csda onboard --project-dir lixy-api` responde «Nothing obvious from the layout» sobre 299 ficheros con `domain/` en la raíz y 8 contextos acotados dentro. `descendThroughWrappers` solo desciende con **un** hijo, y `domain/` tiene dos: `src` y el `build/` de Gradle | **Un directorio de salida de compilación ciega el comando.** Arreglo verificado ejecutando la variante parcheada sobre el repo: (a) saltar el envoltorio `src/main/{java,kotlin}` y (b) ignorar `build`/`target`/`dist`/`out` al contar hijos. Pasa de 0 a los 8 contextos correctos. Hermano de H14 — misma causa de fondo: `NOT_DOMAIN` se aplica donde no toca | **Cerrado** |
| H14 | **`onboard` no ve el código en un layout Java.** `countFiles` poda `src`, `main` y `java` porque están en `NOT_DOMAIN`, así que en un proyecto Maven o Gradle nunca llega a los ficheros. Medido sobre Lakebase: reporta `Platform 1 fichero` donde hay **38**, y `Catalog 2` donde hay **16** | Descubierto ejecutando `csda onboard` contra `lakebase-platform` (§12.14). La lista **se ordena por ese recuento**, así que el orden sale casi invertido: el módulo mayor y más tocado aparece el último. En repos Node la heurística funciona; en Java miente con confianza. **Confirmado por contraste**: sobre `lixi-platform` (TypeScript) el mismo comando acierta los siete contextos con recuentos correctos. Arreglo: no podar por nombre al contar — podar solo lo que no es código (`build`, `target`, `node_modules`) | **Cerrado** |
| H15 | **`validate` da verde sobre una adopción abandonada.** En `lixi-platform`, adoptado hace meses, `validate` responde `✅ Validation passed · Features detected: 1` con un único requisito de relleno (`REQ-001 Existing behaviour is preserved`) mientras el repo tiene **297 casos de test** y 12 contratos JSON congelados que la matriz no describe | No hay diferencia observable entre «adoptado y especificado» y «adoptado y abandonado», y `validate` es el comando que la gente pone en CI. `status` sí es honesto. Arreglo barato: `validate` conoce el `baseline.feature` que él mismo escribe — si es la única feature del proyecto, avisar en vez de dar verde limpio. Ver `lixi-pilot-assessment.md` | **Cerrado** |

**Medido después del arreglo**, con los mismos comandos que los destaparon:

| Repo | Antes | Después |
|---|---|---|
| `lixy-api` desde dentro | proyecto padre, stack Node, capacidades del código muerto | su propia ruta y stack Java, **8 contextos**, y el ancestro adoptado se anuncia en vez de sustituir |
| `lixy-api` con `--project-dir` | «Nothing obvious from the layout» | Booking(28) · Business(20) · Subscription(15) · Wallet(6) · Identity(5) · Notifications(4) … |
| `lakebase-platform` | Platform 1 · Catalog 2 · Engine 1 · Ingestion 2 | **Platform 49 · Catalog 26 · Engine 24 · Ingestion 13 · Sql Engine 4** — el orden ya coincide con el tamaño real y con el churn |
| `lixi-platform` | `✅ Validation passed` y nada más | pasa igual, y avisa: «Adoption never retro-filled» con los tres comandos para salir de ahí |

La puerta **no se endureció**: una adopción fresca sigue pasando `validate`. Un
gate que rechaza el primer día es un gate que nadie instala; lo que no puede es
callarse después.

Tests: `tests/unit/onboard.test.ts` (H14, H16, H17) y `tests/unit/adopt.test.ts`
(H15), cada uno con el repo real que lo destapó citado en el comentario.

### El corpus, o por qué H14/H17 no bastaban (2026-08-18)

Arreglar `onboard` contra Lakebase y Lixi lo dejaba ajustado a **dos** repos. La
comprobación honesta era medirlo contra repositorios que nadie de aquí ha tocado,
así que se reconstruyeron los árboles reales de dieciséis proyectos públicos
(`git/trees?recursive=1`, sin descargar contenido) y se le preguntó a cada uno.

**Resultado inicial: acertaba en 5 de 16.** Nueve no proponían nada y dos
proponían basura — a `ripgrep` le dijo que sus capacidades eran `pkg/brew` y
`pkg/windows`, dos directorios de empaquetado. Ese es el modo de fallo que el
propio comando declara inaceptable: *«a confident wrong answer is worse than
silence»*.

El error era estructural, no de lista: **el repositorio casi siempre declara sus
módulos y nosotros adivinábamos en vez de leerlos.** Un directorio con su propio
manifiesto de build es un módulo por definición del equipo, y una sola regla
cubre Maven, Gradle, workspaces de npm/pnpm, miembros de Cargo, módulos de Go,
gemas de Ruby, proyectos .NET y paquetes de Composer — sin un parser por
ecosistema.

Cinco reglas más, cada una nacida de un repo concreto:

| Regla | La destapó |
|---|---|
| Puntuar los candidatos por código, no coger el primero de la lista | `ripgrep` |
| Pesar solo ficheros de código | `nest` — sus apps de ejemplo pesaban más que los paquetes que ilustran |
| Los módulos en capas se descienden, no se proponen | `lixy-api` — cuatro vistas de un producto no son cuatro capacidades |
| Un reparto donde un hijo se lo lleva casi todo es un envoltorio | `django` — la raíz leía `django` (929) y `js_tests` (11) |
| Un repo puede tener subproyectos y aun así **ser** un proyecto | `loki` — no es su operador de Kubernetes |
| `test/`, `sample/`, `examples/` y `build-logic/` nunca son módulos | `serilog` (cuatro ensamblados de test) y `flask` (tres apps de ejemplo) |

**Ahora responde en 14 de 16, y los otros dos callan a propósito** — `cobra` y
`express` son librerías planas y cualquier estructura sería inventada.

El corpus quedó como suite: `tests/unit/onboard-corpus.test.ts`, un fixture por
forma de layout con el proyecto real que lo motiva citado en el nombre. Incluye
la propiedad que más importa en CI: **la propuesta no cambia después de que
alguien compile.**

> Lección que vale más que el arreglo: dos repos de ejemplo no son evidencia, son
> anécdota. El corpus costó una tarde y encontró once fallos que ninguno de los
> dos pilotos habría enseñado nunca.

### La costura que perdía la adopción entera (2026-08-19)

Al preguntar «qué falta» apareció algo que no estaba anotado y que era más grave
que cualquiera de los defectos anteriores: **`adopt` nunca llamaba a
`proposeCapabilities`.** Los dos comandos no se hablaban.

```
csda onboard   → 8 capacidades, con evidencia y recuento
csda adopt     → spec.md con «REQ-001 Existing behaviour is preserved»
```

Le sacábamos al repositorio su estructura real y acto seguido la tirábamos. Ahí
es exactamente donde murió la adopción de Lixi, y ningún arreglo de `onboard` lo
habría salvado: el comando acertaba y su respuesta no llegaba a ningún sitio.

`adopt` ahora siembra un requisito por capacidad. Cada uno dice **«Proposed, not
specified»**, nombra el directorio y el recuento de donde salió, y entra como
`Draft` con test `TBD` — pasa `--strict-tdd` sin afirmar nada. `--no-capabilities`
lo desactiva.

Medido en Lakebase: `status` pasa de «1 requisito pendiente» a «8 requirement(s)
missing a .feature». De página en blanco a lista de tareas.

**Y el aviso de H15 sigue saltando**, que es lo correcto: sembrar propuestas no es
especificar. La puerta solo se calla cuando hay un escenario de verdad.

> Lección: los defectos de un comando se ven ejecutándolo; los defectos **entre**
> comandos solo se ven preguntando qué falta. `onboard` y `adopt` tenían sus tests
> verdes cada uno por su lado mientras el producto se caía por la junta.

### Abiertos

*Depurado el 2026-08-26.* Esta tabla listaba **H13, H15 y H16** como abiertos
cuando su propia entrada de `CHANGELOG.md` dice que 0.7.0 los cerró el
2026-08-23, junto con H14. Movidos arriba. **H19 cerrado el 2026-08-26** y también
movido. Queda de H18 solo su lección —el test que parsee la salida de cada comando
del contrato—, no el defecto, que se arregló el 2026-08-20. **H20 entró y se cerró el mismo día**,
salió montando el fixture para reproducir H19.

| # | Problema | Nota |
|---|---|---|
| H18 | ([#135](https://github.com/rsaglobaltech/specgate/issues/135)) **`harness run --format json` violaba la regla 1 del contrato** — prosa y documento JSON en el mismo stdout, así que `\| jq .` no parseaba. Arreglado el 2026-08-20 en `E1-02` (la prosa va a stderr en modo JSON) | Estaba desde siempre y nadie lo vio porque **nada parseaba esa salida** hasta que el pool de workers lo intentó. Lección: un comando listado en el contrato y que ningún consumidor parsea no está verificado. Falta un test que parsee la salida de cada comando del contrato |

---

## 12.12 Huecos de producto que el artículo obligó a nombrar

*Anotados el 2026-08-18. Salieron al escribir para un lector de fuera, que es un
ejercicio distinto a escribir para nosotros: hay que decir qué **no** hace.*

La primera versión del artículo los declaraba abiertamente en una sección
«Where it does not work yet». La reescritura narrativa **eliminó esa sección**,
así que quedaron sin sitio. Aquí tienen sitio.

| ID | Hueco | Estado y coste |
|---|---|---|
| **P1** | **Orquestación multi-repositorio.** Una spec no se descompone en trabajo across varios repos. La unidad es el proyecto | **Abierto, v2 — revisado el 2026-08-21**, ver [p1-multirepo-revision.md](p1-multirepo-revision.md). De seis piezas, dos ya estaban hechas: `projects:` cruza repositorios y `validate` ya se despliega sobre ellos. Sigue siendo cambio de modelo lo caro — identificador supra-repo, correlación y matriz federada — y el apaño del issue **no** sirve de base, porque haría del tablero la fuente de verdad que ADR-0021 prohíbe |
| **P2** | **Superficie de lectura para quien no abre PRs.** Las specs viven en git a propósito, porque es lo que permite que CI verifique algo; pero un product owner no entra ahí | **Medio cerrado — revisado el 2026-08-26.** `csda report` **ya se publica**: `04c0c76` (P2 / #102) añadió a `pages.yml` el paso que lo genera contra este mismo repo. Lo que sigue abierto es `csda studio`, y **no es publicable tal cual**: es un servidor HTTP en el puerto 4173 que renderiza en memoria (`StudioCommand.ts:135,170-179`) y carga Mermaid desde `cdn.jsdelivr.net`, así que ni es estático ni funciona sin red. Sigue como C10-06 de §12.13 |

**Por qué importan para 1.0:** ninguno bloquea. P1 está explícitamente fuera de
alcance (D12 movió la distribución a v2 por la misma lógica). P2 es una tarde de
trabajo y mejora la adopción real, así que es buen candidato para la primera
release después del 1.0.

**Lo que sí bloquea sigue siendo G3:** nadie de fuera lo ha usado. P2 lo hace
más probable, pero no lo sustituye.

La taxonomía greenfield/brownfield/bluefield añadió **P3** y **P4** — ver §12.13.

---

## 12.13 Greenfield · Brownfield · Bluefield — dónde encaja este CLI

*Anotado el 2026-08-18. La taxonomía llegó de fuera; la valoración es contra el
código de v0.6.0, no contra la intención.*

### La taxonomía es correcta, pero su eje no es el nuestro

El planteamiento clásico ordena los tres casos sobre el **contrato de API**:
greenfield = *design-first* (se escribe el OpenAPI y de ahí salen scaffolding,
contratos y tests), brownfield = *code-first* (la spec se extrae del código con
anotaciones o ingeniería inversa), bluefield = fachada limpia sobre lo viejo.

Nuestra unidad de spec **no es el contrato de API, es el comportamiento**:
requisitos con escenarios Gherkin y una matriz de trazabilidad de diez columnas.
Consecuencia directa: **la mitad *code-first* de la definición no tiene análogo
aquí.** De una anotación se puede derivar una firma HTTP; no se puede derivar la
intención ni el criterio de aceptación. Un `@Operation` no dice qué debe pasar
cuando el consentimiento del paciente está revocado.

Por eso nuestra respuesta brownfield es otra, y ya está construida:

| Pieza | Qué hace | Por qué no es ingeniería inversa |
|---|---|---|
| `csda adopt` | Instala el esqueleto. Nunca sobrescribe un fichero, nunca toca `src/` | Es mecánico y reversible; no afirma nada sobre el sistema |
| `csda onboard` | Lee el repo y **propone** capacidades con la evidencia de cada una | Es una propuesta con la que discutir, no un dictamen. `scripts/onboard.ts` lo dice en su cabecera |
| `csda req link` | Ata un requisito a código y test **que ya existen** | La spec se **afirma** y CI la verifica. Documentar describe; esto compromete |

La diferencia importa: documentar un sistema heredado produce un texto que nadie
vuelve a leer. Enlazar un requisito a código existente produce una fila que la
build rompe cuando deja de ser verdad.

### Greenfield no es «el escenario ideal» para nosotros — es el que menos prueba

Es donde la herramienta luce, y por eso desconfío de él. El repo ya tiene esa
decisión tomada y escrita en dos sitios:

- **ADR-0015** abre reconociendo el defecto: *«Brownfield was second class»*.
  Todo comando asumía un proyecto generado. El ciclo de cambio existe en parte
  para corregir eso.
- Los **dos pilotos están contrastados a propósito**: CsdaStudioApp es el
  dogfood greenfield; HIE (`mejoras/hie-pilot-runbook.md`) es brownfield real —
  Spring Boot 3.3 / Java 21 + HAPI FHIR, dominio regulado. Su runbook lo dice
  sin rodeos: enlazar REQ-001..009 a código que ya está *«es el trabajo
  brownfield de verdad, y es distinto de generarlo»*.

La escalera L1–L4 de `docs/how-to.md` es la misma tesis en forma de producto:
cada nivel sirve solo y ninguno exige los de arriba. Eso es adopción
incremental, que es lo único que funciona sobre código ajeno.

### Bluefield: el hueco real, y no lo teníamos nombrado

Ni el CLI ni la documentación tienen ruta para el caso híbrido —fachada nueva
sobre sistema viejo, *strangler fig*—, y al mirarlo aparecen tres fricciones
concretas, no una sensación:

1. **La fachada rompe la matriz.** Un requisito cuya implementación es «delegar
   en el legacy» no tiene test propio que pruebe el comportamiento; o la fila
   miente, o hay que escribir *characterization tests* del sistema viejo antes
   de poder enlazar. Nada en `validate` distingue hoy esos dos casos.
2. **`onboard` no duplica: omite en silencio.** ~~Propondrá capacidades
   duplicadas~~ — **medido el mismo día sobre `lixi-platform` y es peor**:
   `DOMAIN_ROOTS` devuelve la primera raíz con ≥2 hijos, así que propuso los 7
   contextos del backend **legacy** e ignoró por completo el backend nuevo (299
   ficheros Java) y la app Flutter (90 Dart). El «Next» que sugiere es describir
   el sistema que se está retirando. Un duplicado se ve; una omisión no.
3. **Suele ser multi-repo**, que es exactamente **P1**. El caso bluefield no es
   un hueco independiente: es el que hace que P1 duela.

Lo que sí encaja ya, y conviene decirlo: las **specs delta** con marcadores
ADDED/MODIFIED/REMOVED son la forma natural de registrar una migración por
estrangulamiento —cada trozo que pasa del legacy a lo nuevo es un `change`, no
una reescritura de la spec entera.

**Y ya no es hipotético** —aunque el ejemplo obliga a afinar la categoría—.
`lixi-platform` migra su API Next.js a Spring WebFlux contra la misma base, y el
equipo construyó a mano la puerta que al caso le faltaba: 12 fixtures dorados
congelados desde la implementación vieja.

Pero **allí el TypeScript es código muerto**, así que no es bluefield del todo:
es **greenfield con contrato** —implementación nueva cuyos criterios de
aceptación vienen de un sistema difunto—. El sistema viejo no es un codebase que
especificar: es **la fuente de la especificación**. Es un cuarto caso, más común
que el bluefield puro (toda reescritura acaba aquí) y **el más favorable para
nosotros**, porque existe un oráculo ejecutable de lo que el código nuevo debe
hacer. Detalle en [`lixi-pilot-assessment.md`](./lixi-pilot-assessment.md).

### Y una promesa que hoy no tiene puerta

La retrocompatibilidad que el caso brownfield exige está **declarada pero no
verificada**. El `project_type: contracts` (ADR-0011) tiene `api_contracts[]`,
`consumer_driven_tests[]` y `breaking_change_rules[]` en el schema, pero
`scripts/lint_pack.ts:111-135` solo comprueba **cobertura referencial** — que
cada REQ esté citado por alguna entrada. No se comprueba que el `schema_ref`
exista, no hay diff de OpenAPI entre versiones, y los Pact no se verifican.

O sea: un pack puede declarar «sin cambios rompedores sin subir major» y pasar
la puerta habiendo roto a todos sus consumidores. Es la única de estas
observaciones que es un defecto, no un hueco de alcance.

### Huecos que esto añade

| ID | Hueco | Estado y coste |
|---|---|---|
| **P3** | **Sin ruta bluefield / strangler fig.** No hay forma de expresar «este requisito lo sirve la fachada delegando en el legacy», `onboard` duplica capacidades cuando conviven dos layouts, y el caso suele ser multi-repo (→ P1) | **Abierto, v2.** No construir un «modo bluefield». Lo barato y honesto es nombrar los tres casos en la escalera L1–L4 de `docs/how-to.md` y documentar el patrón sobre lo que ya hay (change lifecycle + specs delta). El resto espera a que un usuario real lo pida |
| **P4** | **Los contratos de API se declaran, no se verifican.** `breaking_change_rules[]` y `api_contracts[]` solo se lintan por cobertura referencial | **Abierto, barato y es un defecto.** Primer paso, casi gratis: que `pack lint` exija que el `schema_ref` exista. Segundo: diff de OpenAPI entre versiones del pack en `specops diff`. Defiende justo la promesa que el caso brownfield compra |

**Prioridad frente a 1.0:** ninguno bloquea, y P3 no debería adelantarse a **G3**
(nadie de fuera lo ha usado todavía) — inventar el caso híbrido sin un usuario
que lo tenga es diseñar a ciegas. **P4 sí es candidato antes de 1.0**: es un
lint, y hoy la herramienta afirma algo que no comprueba, que es exactamente el
defecto que §12.11 nos enseñó a no tolerar.

---

## 12.14 Inferir specs desde código existente — el diseño, y su banco de pruebas

*Anotado el 2026-08-18. Sale de la pregunta obvia que deja §12.13: si el caso
brownfield es el que importa, ¿podemos **generar** las features desde el código
en vez de pedirlas a mano?*

### La pregunta que decide el diseño

`harness run` va spec → agente → código y funciona **porque tiene puerta
ejecutable**: `validate --strict-tdd` más el comando de test. Señal de
recompensa real.

Al revés —código → agente → spec— **no hay puerta obvia**. Un `.feature`
generado puede ser plausible y falso, y nada falla. Eso es documentación
generada, que es exactamente lo que esta herramienta existe para no producir.
Sin puerta, esto es un generador de mentiras a escala.

### La puerta existe y es barata

**El escenario generado tiene que ejecutarse en verde contra el código sin
tocar.** Verde → describe comportamiento real, y es un *characterization test*.
Rojo → era una suposición, y no entra.

Eso convierte «inferir specs» de documentar (inverificable) a **testear por
caracterización** (verificable), con la misma maquinaria que ya existe: worktree
aislado, shell-out al agente, gate, commit por ítem.

**Refuerzo anti-vacuidad:** un test que pasa puede no afirmar nada. Ya tenemos
Stryker (`mutation:pilot`, baseline 51,32 %). Gate estricto: el escenario debe
**matar al menos un mutante** del código que dice describir.

**La puerta tiene dos niveles, no uno** — corrección que trae `lixi-platform`,
donde un equipo la construyó a mano antes que nosotros: **nivel 1, forma** —el
conjunto de claves del JSON contra un fixture dorado, hermético y rápido, en CI
sin levantar nada— y **nivel 2, valores** —byte a byte contra el sistema vivo,
que es el caro. Nuestro diseño solo contemplaba el nivel 2. El 1 da la mayor
parte del valor por una fracción del coste.

**El premio medible:** hoy `report` cuenta requisitos sin código ni test. Lo
inverso —**código sin requisito**— nunca se ha medido, y es la definición
operativa de «adopción completa». Con los escenarios generados corriendo bajo
cobertura, la unión de líneas cubiertas es *la parte del sistema que está
especificada*. Un número, no una sensación.

### Etapas

| # | Qué | Determinista |
|---|---|---|
| 1 | `onboard` de hoy — capacidades del layout y stack | Sí |
| 2 | **Cosecha de evidencia** por capacidad: símbolos exportados, rutas HTTP, comandos CLI y sobre todo **nombres de tests existentes** | Sí |
| 3 | Pase de agente por capacidad → contrato JSON (ADR-0017) con REQ, Gherkin, enlaces candidatos, confianza y evidencia | No |
| 4 | Gate: verde contra código intacto; con `--strict`, además un mutante muerto. Si no pasa, queda `Unverified` y no cuenta | Sí |
| 5 | Emisión: un `csda change new` por capacidad, spec delta, revisión humana en PR | — |

La etapa 2 es la infravalorada: **un test llamado `rejects_expired_token` ya es
un enunciado de requisito.** Es determinista, gratis, offline, sin proveedor, y
se puede entregar sola.

### Lo que no se hace

- **Que el LLM invente agregados y bounded contexts.** ADR-0014 lo rechazó con
  la razón exacta —«produciría ruido confiado»— y sigue siendo verdad.
- **Escribir directo en `spec.md` o `pack.yaml`.** ADR-0014, alternativa 2. Todo
  sale como `change`, revisable en un PR.
- **Volcado masivo.** Un legacy real da cientos de requisitos y nadie revisa eso.
  Por capacidad, y ordenadas por **churn × acoplamiento** (`git log
  --name-only`): especificar primero lo que más cambia, porque spec sobre código
  congelado no vale nada.

### Banco de pruebas: Lakebase

Evaluado el mismo día — detalle completo en
[`lakebase-pilot-assessment.md`](./lakebase-pilot-assessment.md). Resumen:
plataforma de datos Java 21 / Spring Boot / Gradle multi-módulo, 87 ficheros de
producción, 104 `@Test`, más un SDK y una CLI en Python. **Es mejor espécimen
que HIE para esto**, por dos motivos que no se pueden fabricar:

1. Sus nombres de test ya son enunciados de dominio (`selectExigeSelect`,
   `autenticadoSinConcesionesDenegado`, `herenciaNoAsciende`), o sea la etapa 2
   servida.
2. Tiene **verdad de referencia escrita antes que nosotros**: un inventario
   medido por módulo y una auditoría con hallazgos identificados. Permite medir
   precisión y recall de la inferencia, no opinar sobre si «suena bien».

Ejecutar el CLI contra él ya rindió un defecto (**H14**) y dos huecos.

### El caso que prueba que hace falta: Lixi

Evaluado el mismo día — detalle en
[`lixi-pilot-assessment.md`](./lixi-pilot-assessment.md). No es un candidato a
piloto: es **la prueba, ya ocurrida**, de la premisa de P5.

`csda adopt` se ejecutó allí hace meses. Hoy el repo tiene **1 requisito de
relleno**, 1 feature y 1 fila de matriz — frente a **297 casos de test** (171
TypeScript + 126 Java) y 12 contratos JSON congelados y verificados en CI. Y
**nada de la adopción llegó a git**: `spec.md`, `AI_RULES.md`, `features/` y
`docs/` siguen sin comitear.

> El esqueleto estaba bien puesto y `validate` pasaba. La adopción no arrancó
> igualmente, porque el paso siguiente es «siéntate a escribir requisitos a
> mano». **No es indisciplina del equipo: es el producto pidiendo trabajo que
> puede automatizar.**

Sus 12 fixtures de paridad son requisitos ya verificados. Convertirlos en 12
filas de matriz con `req link`, sin escribir un solo test nuevo, es la demo de
P5 más barata que existe. De aquí salen además **H15** y **P7**.

### Huecos que esto añade

| ID | Hueco | Estado y coste |
|---|---|---|
| **P5** | **No se pueden inferir specs desde código existente.** `onboard` propone capacidades; nadie propone requisitos, escenarios ni enlaces. Un `spec.md` vacío sigue siendo el punto donde se atasca la adopción | **Abierto, la apuesta grande post-1.0.** Etapa 2 determinista ~2-3 PD; etapas 3-4 ~5-8 PD, y el gate es la parte cara. **La etapa 2 se puede entregar sola y antes**: es un cosechador de nombres de test, sin LLM ni proveedor |
| ~~**P6**~~ | ~~**`adopt` no sabe de monorepos.**~~ **Cerrado el 2026-08-19.** `adopt --monorepo` adopta cada módulo declarado y escribe el `specops.config.yaml` que `validate` ya sabía leer | Salió casi gratis: `findDeclaredModules` se había construido para arreglar `onboard` y la lista de módulos era la misma. Medido en Lakebase: 8 módulos adoptados, `validate .` da 8/8. **Sigue abierto L3** — un requisito transversal no tiene dónde vivir, que es **P1** dentro de un mismo repo |
| **P7** | **Las reglas de agente son de raíz y pisan la convención del repo.** `adopt` escribe `AI_RULES.md` sin mirar si ya hay `AGENTS.md` o `CLAUDE.md` — en `lixi-platform` dejó un tercer fichero de reglas huérfano junto a dos que sí se leen. Y de fondo: **sus reglas son por ruta y las nuestras no**. Un repo con dos backends bajo reglas opuestas («nunca bloquees el event loop» vale en `lixy-api/` y no significa nada en la raíz) no puede describirse con un `AI_RULES.md` único | **Abierto, barato.** Dos piezas separables: (a) `adopt` detecta `AGENTS.md`/`CLAUDE.md` y se integra en vez de añadir un tercero — `csda agents init` ya escribe `AGENTS.md`, así que la mitad existe; (b) reglas por ruta, que es la misma forma que pide P6. Bluefield lo necesita por definición |

**Prioridad frente a 1.0, revisada con Lixi encima de la mesa:** el argumento de
«no adelantarse a G3» se sostenía cuando el único espécimen era Lakebase — un
repo que se puede medir, pero no un usuario. Lixi es distinto: **es una adopción
real que se murió sola**, y eso es una necesidad demostrada, no una hipótesis.

Aun así P5 completo sigue sin caber en 1.0: son 8-11 PD y una dependencia de
proveedor. Lo que sí sube de prioridad es lo que no necesita agente:

- ~~**H14, H15, H16 y H17**~~ — **cerrados el 2026-08-18** en
  `fix/brownfield-onboarding-java`. Eran la puerta de entrada entera sobre Java: o
  te mandaba al proyecto equivocado, o callaba sobre 299 ficheros, o ordenaba al
  revés, o certificaba una adopción vacía. Detalle y medidas en §12.11.
- ~~**P6**~~ (`adopt --monorepo`) — **cerrado el 2026-08-19**.
- **Etapa 2** (cosecha de nombres de test) — sin LLM, sin proveedor, sin decisión de
  modelo. Es lo siguiente.
- **P7 (a)** — detectar `AGENTS.md` en vez de dejar un fichero huérfano. Es una
  comprobación de existencia.

---

## 12.13 Fase 10 — El plano de control: MCP + Studio

*Decidido el 2026-08-26, al valorar si tenía sentido construir un IDE agéntico
propio al estilo de [kiro.dev](https://kiro.dev). **La conclusión fue que no**, y
esta fase es lo que se hace en su lugar. Va **después** del hueco de
verificación (D14) y **no bloquea el 1.0**.*

### Por qué no un IDE propio

Kiro es un fork de VS Code con un flujo spec-driven fino: tres markdown
(`requirements.md`, `design.md`, `tasks.md`), hooks y autopilot. Su fuerza es la
superficie; su debilidad es justo donde este repo es fuerte.

| | Kiro | `create-spec-driven-app` |
|---|---|---|
| Puerta ejecutable | No. Nada falla si un requisito no tiene escenario ni test | `validate --strict-tdd` rompe el build |
| Trazabilidad | Implícita en los tres ficheros | Matriz de diez columnas, verificada en CI |
| Cambio sobre lo ya entregado | Se reedita el markdown | Delta revisable como intención (`change new/validate/archive`) |
| Dominio reutilizable | No existe | Packs versionados, firmados, con `specops diff --as-change` |
| Agente | El suyo, y solo el suyo | Cualquiera — el harness acepta `claude`, `aider`, `opencode`, y perfiles por requisito |

Esa última fila es el foso: Kiro no puede copiarla sin dejar de ser Kiro. Y
forkear un IDE cuesta lo que no tenemos — rebase continuo sobre upstream, un
marketplace propio (el de Microsoft no es usable en un fork), auth, updater,
firma de binarios en tres SO. Es una persona a tiempo completo antes de escribir
producto, para competir de frente con algo gratis y respaldado por AWS.

**La decisión (D15): no se construye editor. Se construye el plano de control, y
los IDEs ajenos pasan a ser adaptadores.** Dos superficies sobre el mismo
núcleo, que ya existe:

- **MCP para el agente.** Claude Code, Cursor, Copilot — y Kiro mismo —
  consumen las specs por ahí. Ellos pagan el coste del IDE.
- **Studio para la persona.** La cola, el grafo, el estado del harness, el
  diff de intención. Es P2 de §12.12 con más ambición.

El posicionamiento deja de ser «otro IDE agéntico» y pasa a ser **la capa de
cumplimiento que hace que cualquier agente entregue trabajo trazable**.

### El desalineo que destapó la valoración

**El servidor MCP expone 7 herramientas de una superficie de 32 comandos.**
`packages/mcp-spec-driven/src/tools.ts` registra `read_spec`,
`list_requirements`, `update_traceability`, `lint_pack`, `validate_project`,
`plan` y `mark_requirement_done`. Fuera quedan el ciclo `change` entero,
`specops`, `harness`, `req`, `status`, `onboard`/`adopt`, `report`, `doctor` y
`fix` — es decir, casi todo lo que distingue a esta herramienta de un linter de
markdown. Un agente conectado por MCP hoy **no puede** proponer un cambio ni
consumir un pack; tiene que salir a `Bash` y perder la puerta.

Y es exactamente el defecto que §12.5 ya arregló para `PROJECT_TYPE`: una
superficie aceptada por una puerta y desconocida por otra, sin ningún test que
las fije juntas.

**Hay dos cosas llamadas «studio» y no son la misma.** `csda studio`
(`scripts/cli/commands/spec/StudioCommand.ts`, registrado en
`scripts/lib/surface.ts:523`) sirve un HTML local de solo lectura del árbol de
specs. `CsdaStudioApp` es un repo aparte, SPA de React, que lee `pack.yaml` y
está parado en la fase 8 de `csda-studio-handoff.md`. Antes de invertir en
ninguno hay que decidir cuál es el producto.

### Tareas

| ID | | Tarea | Detalle |
|---|---|---|---|
| C10-01 | `[x]` | **Corregida por ADR-0024** — ejecutar ADR-0019 ([#137](https://github.com/rsaglobaltech/specgate/issues/137)) | ADR-0024 reafirma ADR-0019: `csda studio` es el producto, `CsdaStudioApp` es solo un experimento de dogfood |
| C10-02 | `[x]` | Paridad MCP ↔ superficie del CLI ([#138](https://github.com/rsaglobaltech/specgate/issues/138)) | Hecha en 0.8.0: el registro se genera desde `scripts/lib/surface.ts`. Medido en `main`: **56 comandos/subcomandos, 58 herramientas**. C10-03 y C10-05 también cerradas; queda solo **C10-04** |
| C10-03 | `[ ]` | Un test que fija las dos listas juntas | El registro MCP se deriva de `scripts/lib/surface.ts` o falla CI. Escribir 25 herramientas a mano garantiza que el desalineo vuelva. Mismo remedio que el test de los cuatro sitios de §12.5 |
| C10-04 | `[ ]` | Contrato de límites en las herramientas que mutan | El agente no edita `docs/specs/**` ni `features/**` salvo por el ciclo `change`. Hoy eso lo impone el texto de `.harness/prompt-prefix.md`; una herramienta que lo imponga no depende de que el agente lea |
| C10-05 | `[ ]` | `csda mcp install --client <claude\|cursor\|vscode\|kiro>` | Escribe la config del cliente. Hoy `packages/mcp-spec-driven` no tiene ruta de instalación, y **D9/D12 lo dejaron sin publicar**: esta tarea reabre esa decisión o el plano de control no tiene puerta de entrada |
| C10-06 | `[x]` | Publicar la superficie de lectura ([#139](https://github.com/rsaglobaltech/specgate/issues/139)) — **cierra la mitad que le queda a P2 de §12.12** | **Corregido el 2026-08-26, el mismo día que se escribió esta fase:** `csda report` ya está publicado desde `04c0c76`; escribí «cierra P2» sin comprobarlo. Queda `csda studio`, y antes hay que decidir qué es: hoy es un servidor HTTP que renderiza en memoria y tira de `cdn.jsdelivr.net`. Publicarlo exige salida estática y Mermaid empaquetado — resuelto con `csda studio --out` y bundle offline. |
| C10-07 | `[ ]` | El Studio deja de ser solo visor de specs | Cola de `plan`, estado del harness por rama, diff de intención de un `change` abierto. **Sigue siendo solo lectura**: git es la fuente de verdad y ADR-0021 prohíbe que el tablero la sustituya |
| C10-08 | `[ ]` | Terminar el dogfood — fases 8–10 de `csda-studio-handoff.md` | Experimento de dogfood para validar el flujo (reafirmado por ADR-0024), no un producto. Parado desde 2026-05-15. |

### Gate de la fase

**Un agente completa un requisito de punta a punta usando solo herramientas MCP
—sin invocar `csda` por `Bash`— y la paridad superficie ↔ MCP la comprueba un
test, no una lectura.** Es la versión MCP de G2, y por la misma razón: este tipo
de defecto solo aparece ejecutando.

### Fuera de alcance, explícito

- **Un editor propio, forkeado o no.** Es la decisión D15 entera.
- **Un servicio hospedado o backend del Studio.** Local-first, como el brief ya
  congeló.
- **Que el Studio escriba en el árbol.** Convertirlo en editor lo hace fuente de
  verdad paralela, que es lo que ADR-0021 prohíbe.
- **Publicar los plugins de Maven/Gradle y el registry.** Sigue en v2 (D12).
  C10-05 solo reabre el caso del **paquete MCP**, que es la puerta de entrada.

### Relación con el 1.0

Ninguna tarea de esta fase es un gate de 1.0, y ninguna lo retrasa: van después
del hueco de verificación (D14). Pero **C10-06 y C10-08 empujan G3** —«un equipo
de fuera adopta y reporta»—, que es el único gate que sigue dependiendo de que
alguien ajeno al repo lo use. Una superficie de lectura publicada y un producto
construido con la propia herramienta son lo que hace que ese alguien aparezca.

---

## 12.14 Deuda de la rama de verificación, antes de mergear

*Medido el 2026-08-26 contra `feature/predictable-code-plan-rewrite`: 8 commits
por delante de `origin/main`, 0 por detrás, **sin PR**. Se anota aquí porque la
decisión explícita es **no publicar versión nueva todavía** — así que esto no es
una checklist de release, es lo que falta para que la rama pueda entrar.*

**Lo que ya está verde**, para no repetirlo: `typecheck`, `format:check`,
`docs:agent-contract:check` y `selfcheck` pasan, y los dos gates nuevos
(`validate . --strict-links` y `--strict-requirements`) pasan sobre este mismo
repositorio. El trabajo está hecho; lo que falta es que se pueda contar.

**La rama toca un único fichero de `docs/`: `docs/specs/agent-contract.md`.**
Ahí está toda la deuda de abajo.

| ID | | Tarea | Detalle |
|---|---|---|---|
| DV-01 | `[x]` | `docs/commands.md:29` anuncia dos gates de cuatro | Dice `csda validate [--strict-tdd] [--against-lock]`. `scripts/lib/surface.ts:212` ya lista los cuatro. La ayuda del CLI y la doc de usuario no coinciden. **Hecho.** `docs/commands.md` — la fila de `validate` lista los cuatro gates, y se añaden `csda change new --from-value-drift` y la mención de deriva de valores en `report` |
| DV-02 | `[x]` | `docs/validating.md` documenta solo `--strict-tdd` | 71 líneas, un solo gate. **Y el hallazgo incómodo: `--strict-scenarios` se publicó en 0.7.0 y nunca se documentó** — solo aparece en `docs/specs/harness.md`. No es deuda de esta rama: es deuda **ya en manos de usuarios**. **Hecho.** `docs/validating.md` pasa de 71 a 183 líneas: sección «The other three gates» con lo que cada uno **no** comprueba, y por qué `--strict-links` es opt-in (medido, no supuesto) |
| DV-03 | `[x]` | `CHANGELOG.md` — `[Unreleased]` está vacío | Seis commits de features detrás: `--strict-requirements`, `--strict-links`, la sección de deriva de valores de `report` y la ruta 2 de resolución de divergencias. **Hecho.** `[Unreleased]` con las cuatro entradas y el porqué de cada restricción — incluida una entrada de `Documentation` que admite el desliz de `--strict-scenarios` |
| DV-04 | `[x]` | Un ADR para el cruce de línea | Pasar de comprobar papeleo a comprobar contenido es exactamente lo que ADR-0019…0022 registran. Y hay una decisión concreta sin registrar: **`--strict-values` se rechazó como gate y se degradó a informe agregado**, razonado en `PLAN_PREDICTABLE_CODE_EVOLUTION.md` §8.6 y en ningún ADR. **Hecho.** [`ADR-0023`](../docs/specs/adr/0023-checking-content-gate-or-report.md) — «a gate where it is decidable, a report where it is not». Cinco reglas, cuatro alternativas rechazadas, e indexado en `docs/specs/adr/README.md` |
| DV-05 | `[x]` | Documentar el informe de deriva de valores | `csda report` gana una sección y `--record` tres campos aditivos. `docs/` no lo menciona en ningún sitio. **Hecho.** Documentado en `docs/validating.md` como sección propia, no como gate, con las tres rutas de resolución |
| DV-06 | `[x]` | Abrir el PR | **Hecho el 2026-08-26, al segundo intento.** #132 y #133 se abrieron sobre una `origin/main` **obsoleta en local** —nunca se hizo `fetch`— cuando el track de verificación ya estaba mergeado como #131 (`cd15591`, squash, 10:56). #132 salió `CONFLICTING` por commits duplicados y **por eso no corrió CI**: sin merge-ref GitHub no lanza el workflow. Rehecho con cherry-pick de los cuatro commits que sí aportan sobre `origin/main`. Ver §12.15 |

**Cerrada el 2026-08-26.** Las seis tareas hechas en la misma sesión. La rama deja de ser trabajo invisible: lo que hacía no estaba en ningún documento que un usuario abra, y ahora sí. **Sigue sin publicarse versión** — D17 se mantiene: esto era hacer mergeable la rama, no sacar la 0.8.0.

### Lo que salió al hacer DV-01…DV-05 (2026-08-26)

**ADR-0019 ya decidió lo que C10-01 planteaba como decisión abierta.** Al buscar
el formato de ADR salió `0019-studio-surface.md`, *«One studio surface: `csda
studio`, not a standalone app»*, **Accepted** el 2026-08-16. Compara las tres
vías que habían convergido —la fase 4 de `visual-pack-authoring-todo.md`, el
brief de `CsdaStudioApp` y el subcomando— y elige el subcomando, diciendo
explícitamente del SPA que es *"exactamente lo que la fase 4 prohibía"*.

O sea: **C10-01 de §12.13 está mal planteada.** No es «decidir cuál de los dos
studios es el producto» — eso está decidido y aceptado. Es *«ejecutar ADR-0019,
o revocarlo con un ADR nuevo que diga por qué»*. Y si se mantiene, arrastra a
C10-08: el dogfood construye precisamente el standalone que el ADR descarta, lo
cual no lo invalida como **experimento** —sigue probando el flujo de punta a
punta— pero sí como producto. Anotado, sin tocar §12.13 todavía: es decisión de
producto, no de documentación, y esta tanda era documentación.

**Prettier no cubre markdown.** `npm run format:check` corre solo sobre
`bin/**`, `scripts/**`, `tests/**`, `packages/**` y `features/**` en `.ts`/`.js`
— y CI no ejecuta nada más. `docs/validating.md`, `docs/commands.md`,
`CHANGELOG.md` y `docs/specs/adr/README.md` **ya fallaban** `prettier --check`
antes de tocarlos, comprobado contra `HEAD`. No se han reformateado: hacerlo
metería cientos de líneas ajenas en este diff. Deuda menor, anotada aquí para
que no se descubra dos veces.

**Verde tras los cambios:** `selfcheck` y `docs:terminal:check` siguen pasando.

### Y una cosa que no es de la rama, pero se ve desde aquí

**Este repositorio se dogfoodea al 18 %.** Medido con `csda status` el
2026-08-26: **22 requisitos, 4 `done`, 18 sin fichero `.feature`**. Coincide con
lo que `csda report` publica ya en Pages desde `04c0c76`.

No bloquea nada hoy porque nadie de fuera ha mirado. En cuanto **G3** ocurra
—un equipo externo adoptando y reportando— será lo primero que vean: el proyecto
que vende trazabilidad exigida por CI, con dieciocho requisitos propios sin
escenario. Es el mismo defecto de la serie H visto desde fuera en vez de desde
el gate.

---

## 12.15 Dos defectos de proceso, encontrados abriendo PRs (2026-08-26)

Ninguno es de producto. Los dos costaron trabajo real el mismo día, y los dos
son invisibles hasta que alguien abre un PR.

### P3 · Un PR apilado no tiene CI, y nada lo dice ([#136](https://github.com/rsaglobaltech/specgate/issues/136))

`.github/workflows/ci.yml` dispara con:

```yaml
on:
  pull_request:
    branches: [main]
```

El filtro `branches:` en un evento `pull_request` mira la **rama base**, no la
rama de trabajo. Un PR cuya base es otra rama de feature —lo normal al apilar
un arreglo sobre una revisión en curso— **no lanza ningún workflow**, y GitHub
lo presenta como «no checks reported», que es indistinguible de «CI aún no ha
arrancado».

Pasó con #133, apilado sobre #132. La revisión habría leído el diff sin una
sola comprobación detrás, y nada en la interfaz lo advierte.

**Salidas, ninguna gratis:** añadir `feature/**` al filtro (CI corre de más),
usar `merge_group`, o prohibir apilar y exigir base `main` siempre. Sin decidir.

### P4 · Un `origin/main` obsoleto en local convierte un merge en un conflicto

El track de verificación se mergeó como **#131** (`cd15591`, squash) a las
10:56. La sesión que abrió #132 no hizo `git fetch` en ningún momento, midió
`origin/main...HEAD` contra una referencia de hace horas, leyó «0 por detrás» y
abrió el PR sobre esa premisa.

Resultado: #132 llegó `CONFLICTING` con seis commits que ya estaban en `main` en
forma de squash — y git **no reconoce un squash-merge**, así que un rebase
normal intenta reaplicarlos en vez de descartarlos. Se rehízo con cherry-pick
de los cuatro commits que sí aportaban.

**Lo que sí sobrevivió intacto: #131 mergeó el código sin nada de su
documentación.** Comprobado contra `origin/main`: `[Unreleased]` vacío,
`docs/validating.md` sin mención de ningún flag nuevo, `commands.md:29`
anunciando dos puertas de cuatro. DV-01…DV-05 valían enteros; lo duplicado era
solo el código.

**Regla que sale de aquí:** `git fetch` antes de medir distancia a `main`, y
antes de abrir cualquier PR. Es la versión de red de la regla que D16 ya
escribió para el disco — *una fila del plan no es evidencia; se comprueba*.

---

## 12.16 Dónde queda todo — cierre de la sesión del 2026-08-26

Foto tomada al cerrar, con los issues abiertos como destino de cada pendiente.
**0.8.1 publicada y verificada el 2026-09-01** (D19, D21). D17 cerrada. Los tres artefactos vivos y comprobados desde fuera del repo: npm público `@rsaglobaltech/specgate@0.8.1` con procedencia SLSA, GitHub Packages, y `ghcr.io/rsaglobaltech/specgate:0.8.1`. `npx @rsaglobaltech/specgate@0.8.1 --help` e `init --dry-run` responden, y el alias `csda` del paquete publicado devuelve `0.8.1`. **Queda el `npm deprecate` de `create-spec-driven-app`**, que es manual a propósito.

### Cerrado hoy

| | Qué |
|---|---|
| DV-01…DV-06 | §12.14 entera. La documentación que #131 mergeó sin traer |
| ADR-0023 | La regla: gate solo si fallar siempre es defecto; si no, opt-in o informe |
| H19 | El gate aprobaba a un agente que no escribió nada. Reproducido, arreglado, fijado |
| H20 | Un proyecto recién generado no pasaba sus propias puertas |
| H21 | El piloto de mutación medía un shim de 19 líneas. Baseline real: **55,14 % sobre 749 mutantes** (Stryker 10), no 51,32 % sobre 4 |
| P3, P4 | Los dos defectos de proceso de §12.15 |
| — | 17 artefactos de build de Gradle dejan de estar versionados. El árbol queda limpio por primera vez |

### El tracker, revisado entero el 2026-08-26

Los 21 issues abiertos cruzados **contra el CLI**, no contra el recuerdo — después
de que este mismo plan mintiera cuatro veces en un día sobre qué estaba hecho.
Resultado: el inventario era honesto salvo una cosa, y quedan **20**.

- **#101 (G5) cerrado a mano**, porque no se autocerró: el cuerpo de #142 decía
  `Closes **GATE-G5** (#101)` y el parser de GitHub exige la palabra clave pegada
  a la referencia. `closingIssuesReferences` daba 0. Una palabra de cierre que no
  cierra es la misma forma que todo lo demás de hoy: algo que afirma más de lo
  que hace.
- **#32, #33 y #34** (del 15 de mayo) tenían **el cuerpo vacío** y ninguna
  etiqueta — solo un título con formato de nota suelta. Verificados contra el
  CLI: `harness --verbose`, `init --multi-stack` y las seis mejoras de
  `pack infer` **siguen sin existir**, así que eran válidos, solo ilegibles.
  Reescritos con el estado medido y etiquetados. **Los tres cerrados**: `#32`
  (`pack infer`) y `#34` (`harness --verbose`) el 2026-09-01, `#33`
  (`init --multi-stack`) el 2026-09-02. En `#33`, la mitad del trabajo ya
  existía y nadie lo sabía —`projects:`, que `validate`, `plan`, `status` y
  `report` ya recorren (#103/#104)—; faltaba solo la mitad que genera. Se
  comparten `spec.md`, `features/` y los ADR; la **matriz no**, porque mapea un
  requisito al fichero que lo implementa y al que lo prueba, y esos son ficheros
  distintos en cada stack. Compartir es enlazar simbólicamente; en Windows, que
  no crea enlaces sin Developer Mode, se copia y **la garantía se muda a la
  puerta**: `validate` falla si una copia deja de coincidir con la raíz.
- **#109 y #110** llevan `help wanted` sobre trabajo que ocurre en **otros
  repositorios**, que es exactamente lo que atrajo dos PRs de farmeo de bounties
  (#118, #119, cerrados). Se les añadió qué hace falta de verdad y qué forma tiene
  la evidencia.
- **#103 y #107 estaban bien escritos** y merecen decirse: #103 ya documenta qué
  parte funciona y nadie había anotado, con salida medida; #107 se distingue solo
  del reviewer consultivo que ya existe. Lo contrario del problema de hoy.

Estado final: **20 abiertos, todos con etiqueta y con cuerpo.**

### Abierto, con dueño

| Pendiente | Issue | Bloquea 1.0 |
|---|---|---|
| **G3** — un equipo de fuera adopta y reporta | [#100](https://github.com/rsaglobaltech/specgate/issues/100) | **Sí — y ya es el único** |
| ~~**G5**~~ — **cerrado el 2026-08-26**: la cláusula de escape fuera, el compromiso aceptado, y `SECURITY.md` corregido (declaraba `0.2.x` cinco minors tarde) | [#101](https://github.com/rsaglobaltech/specgate/issues/101) | ~~Sí~~ |
| H18 — un test que parsee la salida de cada comando del contrato | [#135](https://github.com/rsaglobaltech/specgate/issues/135) | No, pero no publicaría 1.0 sin él |
| P3 — CI ciego a los PR apilados | [#136](https://github.com/rsaglobaltech/specgate/issues/136) | No |
| C10-01 — ejecutar ADR-0019 o revocarlo | [#137](https://github.com/rsaglobaltech/specgate/issues/137) | No |
| ~~C10-04 — contrato de write-scope en MCP~~ | [#138](https://github.com/rsaglobaltech/specgate/issues/138) | **Cerrada** el 2026-09-01. Fase 10 completa |
| C10-06 — publicar `csda studio` (estático + Mermaid empaquetado) | [#139](https://github.com/rsaglobaltech/specgate/issues/139) | No |
| C8-01 — dogfood CsdaStudioApp, fases 8–10 | [#109](https://github.com/rsaglobaltech/specgate/issues/109) | No; y ver #137 antes de gastar más |

### G5 — cerrado el mismo día, por decisión explícita

Era una línea de `docs/release-process.md`, y no se tocó hasta que hubo decisión,
porque borrarla **es** aceptar mantener el minor anterior seis meses — compromiso
de mantenimiento, no edición de documentación. Decidido y hecho el 2026-08-26.

**Queda G3 como único gate de 1.0 abierto**, y es el que no depende de escribir
nada: alguien de fuera tiene que usarlo y contarlo.

### La lectura del 1.0 no ha cambiado

Sigue a **una release, una frase y un usuario real**. Lo de hoy no acerca ninguno
de los tres — acerca que la release, cuando se haga, no salga con las puertas sin
documentar ni con el gate aprobando trabajo vacío.

---

## 13. Backlog aparcado

Nada de esto se pierde; simplemente no entra en el cierre. Cada línea lleva el motivo.

| Ítem | Motivo |
|---|---|
| `csda agent` / agent-cli y `csda-agent` | Fuera de alcance por D2. El propio ADR de la rama concluye que el enfoque de permisos de F2 es un callejón sin salida |
| Watch mode y `validate --watch --serve` | Nunca llegó a ningún checklist desde `risk-mitigation-plan.md` §7.2 |
| `pack publish` | Depende de C7-09 (registry desplegado) |
| Plantillas GitLab CI y Azure DevOps | El generador multi-proveedor (B1) llega en C0-05; estas plantillas concretas no |
| Workshop decks (`docs/workshops/*.md`) | Material comercial, no producto |
| `docs/retros/phase-N.md` | Los gates de decisión de 90/180/365 días nunca se ejecutaron |
| Distribución como binario único | Marcado "optional" ya en el plan original |
| `pack lint --graph-out` y `--export eraser` | La redirección de shell cubre el primero; el segundo esperaba a que un usuario lo pidiera |
| `pack infer --llm` | Diferido explícitamente en ADR-0014 |
| Adaptador AetherDeploy | `mejoras/aetherdeploy-assessment.md` (local, no versionado) es una evaluación sin ninguna de sus acciones de corto plazo implementada |
| Stretch goals de StudioApp | Declarados no-objetivos de v0.1.0 en `csda-studio-brief.md` §4 |

---

## 14. Registro de decisiones

| Fecha | Decisión | Motivo |
|---|---|---|
| 2026-08-16 | `feature/enterprise-adoption` se rebasa y mergea (D1) | 19 commits de trabajo enterprise ya escrito, en TypeScript, con base de merge = `main` y un solo conflicto trivial |
| 2026-08-16 | agent-cli y csda-agent fuera de alcance (D2) | No aportan al objetivo de uso enterprise; se archivan como tags |
| 2026-08-16 | Distribución: npm público + Docker/ghcr + Maven/Gradle (D3) | Cubre las dos audiencias reales: equipos Node y equipos Java |
| 2026-08-16 | Se crea este fichero como punto de partida único | El trabajo estaba repartido en seis documentos con marcadores contradictorios |
| 2026-08-16 | `main` es la única línea de integración; `develop` eliminada (D5) | Llevaba 136 commits de retraso y su único commit propio era el de la rama codex. El repo ya trabajaba con ramas `feature/*` directas a `main` |
| 2026-08-16 | El scaffolding de runtime se porta a TypeScript, no se mergea (D6) | El commit original es pre-ADR-0008: toca `tests/cli.test.js` y scripts `.sh` que ya no existen. Preservado en `archive/runtime-env` |
| 2026-08-16 | Las ramas muertas se archivan como tags `archive/*` antes de borrarlas | Deja el remoto legible sin perder historia. 6 tags creados |
| 2026-08-16 | `feature/daily-ux-roadmap` triada (C0-10) | Se recuperan 6 comandos y 2 paquetes; se descartan los dos refactors masivos y las dos implementaciones duplicadas. Detalle en §3.3 |
| 2026-08-16 | La recuperación (C0-11) puentea estilos en vez de unificarlos | 11 líneas de `require()` en la frontera contra un refactor de 64 ficheros. La mezcla ESM/CommonJS es cosmética: `tsc` con `module: commonjs` compila ambas |
| 2026-08-16 | Los 10 PRs de Dependabot: 6 mergeados, 4 cerrados con motivo (D7) | 6 verdes tras correr la suite; 2 cerrados por config equivocada (`typescript` y `@eslint/js` fuera de su grupo, arreglado en `dependabot.yml`) y 2 por suelo de plataforma (§12.7). Cero PRs abiertos |
| 2026-08-16 | `js-yaml` 4 → 5 se mergea pese a ser major (D8) | js-yaml 5 pasa a YAML 1.2, donde `yes`/`no`/`on`/`off` dejan de ser booleanos. Los tres sitios de producción pasan `{ json: true }`, que ya forzaba esquema JSON, así que el cambio no les afecta. Comprobado ejecutando ambas versiones sobre el mismo documento: salida idéntica, y coincide con `parseYamlLite` del propio CLI |
| 2026-08-17 | Publicar plugins Maven/Gradle, extensión y registry se mueve a **v2** (D12) | No entra en el alcance de 1.0. 1.0 estabiliza el CLI y el formato de packs; los canales de distribución adicionales son otro producto con otras credenciales y otro ciclo. Ya estaban `[-]` en §12.8 |
| 2026-08-17 | **G2 cumplido y 0.5.0 publicada** (D13) | El bucle se ejecutó con Claude sobre REQ-001 y encontró tres defectos reales, todos arreglados en 0.5.0 — la primera release desde 0.2.1 que no rompe nada, o sea media condición G1. 1.0 sigue a dos ejecuciones limpias y un usuario real |
| 2026-08-17 | Suelo a **Node 22** y **0.4.0 publicada** (D11) | Node 20 salió de LTS en abril, así que la matriz probaba un runtime sin soporte. Se publicó sola y de inmediato porque 0.3.0 declaraba `>=20` mientras CI ya no lo cubría: una promesa sin verificar en `latest`. Desbloquea `cucumber 13`. Política escrita: el suelo es una LTS mantenida |
| 2026-08-17 | **0.3.0 publicada** (D10) | 34 commits sin publicar desde 0.2.1, con media release ausente del CHANGELOG. npm `latest` = 0.3.0 con procedencia SLSA, `ghcr.io/rsaglobaltech/csda:0.3.0` multi-arch, notas de release escritas. Verificada desde cero con `npx create-spec-driven-app@0.3.0` generando un proyecto móvil |
| 2026-08-17 | Publicar plugins Maven/Gradle, la extensión de VS Code, el scope npm y el registry queda **aplazado** (D9) | No es prioridad ahora. No bloquea nada: el CLI ya está en npm y la imagen en ghcr, que son las dos vías reales. Marcadas `[-]` con motivo, no descartadas — ver §12.8 |
| 2026-08-16 | Los refactors `import/export` y `strict mode` no se mergean | 96 ficheros entre los dos, todos tocados también por el merge enterprise. Sin valor para el usuario y con coste de conflicto alto. Si se quieren, son tarea propia sobre `main` |
| 2026-08-25 | Se antepone cerrar el hueco de verificación (`csda validate` solo comprueba papeleo, no código) a los gates de 1.0 que faltan (D14) | Al revisar `PLAN_PREDICTABLE_CODE_EVOLUTION.md` se confirmó que el hueco real frente a Predictable Code es uno solo — `--strict-tdd` son 3 reglas sobre la matriz, cero parsers de código en el repo — y se decide ir a por él ya. Se acepta el coste: `GATE-G3`/`GATE-G5` quedan pospuestos, y `GATE-G1` se pondrá a prueba con la primera release aditiva grande del proyecto en vez de con una pequeña primero. Detalle del coste en §12.10 |
| 2026-08-26 | No se construye un IDE agéntico propio; se construye el plano de control — MCP para el agente, Studio para la persona (D15) | Se valoró clonar [kiro.dev](https://kiro.dev). Forkear VS Code cuesta una persona a tiempo completo en rebase de upstream, marketplace propio, auth, updater y firma en tres SO, antes de escribir producto, y para competir de frente con algo gratis y respaldado por AWS. Lo que Kiro no puede copiar sin dejar de ser Kiro es la neutralidad de agente del harness, y eso ya existe. Las piezas del plano de control también: `packages/mcp-spec-driven`, `csda studio`, `csda report`, el LSP y las extensiones. Lo que falta es coherencia, no código nuevo: el servidor MCP expone 7 herramientas de 32 comandos. Detalle y tareas en §12.13 |
| 2026-08-26 | El plan se depura contra el repo antes de responder qué falta para 1.0 (D16) | Cuatro afirmaciones del propio plan estaban desfasadas y todas hacia el lado pesimista: §12.11 daba H13/H15/H16 por abiertos cuando 0.7.0 los cerró, §12.12 daba P2 por sin publicar cuando `04c0c76` ya publica `csda report`, §12.10 daba G1 por cumplido «con matiz» cuando 0.7.0 es la release aditiva y limpia que ese matiz pedía, y C10-06 —escrito ese mismo día— heredaba el error de P2. Regla que sale de aquí: **una fila del plan no es evidencia; se comprueba contra el disco antes de citarla.** Es la misma disciplina de §1 de `PLAN_PREDICTABLE_CODE_EVOLUTION.md`, aplicada a este fichero |
| 2026-08-26 | La rama de verificación **no se publica todavía**; primero se salda su deuda de documentación y se mergea (D17) | Decisión del usuario: no sacar versión nueva aún. El trabajo de D14 está hecho y verde —`typecheck`, `format:check`, `docs:agent-contract:check`, `selfcheck` y los dos gates nuevos sobre este propio repo—, pero la rama toca **un solo fichero de `docs/`**, el `[Unreleased]` del CHANGELOG está vacío y no hay ADR del cruce de línea ni del rechazo de `--strict-values` como gate. Publicar así repetiría lo que DV-02 destapó: **`--strict-scenarios` salió en 0.7.0 sin documentar**, o sea un gate en manos de usuarios que no saben que existe. Tareas en §12.14 |
| 2026-08-26 | Las ramas se rehacen sobre `main` en vez de rebasarse, y #132/#133 se cierran (D18) | El track de verificación ya estaba en `main` como #131 (`cd15591`, squash) desde las 10:56; el `origin/main` local nunca se refrescó. Un rebase no sirve —git no reconoce un squash-merge y reaplicaría los seis commits duplicados—, así que se hace cherry-pick de los cuatro que sí aportan: documentación, ADR-0023, H19 y H20. Un solo PR contra `main`, que además es el único que **tiene CI**: #133 estaba apilado y el filtro `pull_request: branches: [main]` lo dejaba sin workflow. Detalle en §12.15 |
| 2026-09-01 | Se corta la **0.8.0** y con ella el cutover de registries; D17 queda cerrada (D19) | El rename estaba a medias en el peor sitio: `package.json` decía `specgate`, npm servía `create-spec-driven-app@0.7.0` y `specgate` estaba libre, así que el primer comando del README no resolvía. `docs/release-process.md` ya dice que el rename y la release que publica `specgate` son un solo evento. Se cierra el `[Unreleased]` (91 commits), se publica por tag y el `npm deprecate` del paquete viejo queda como acto manual posterior. Los templates dejaron de sembrar el nombre viejo **antes** del deprecate, que era la condición para no endosar deuda a los proyectos generados |
| 2026-09-01 | Dos merges paralelos habían borrado `adopt`, media `onboard`, el aviso H15 y tres herramientas MCP; se restauran antes de publicar (D20) | `specgate adopt` no arrancaba: la plantilla pide `{{PROPOSED_REQUIREMENTS}}` y nadie la aportaba, porque P6 (792156e) y el refactor de arquitectura (b2dc058) fueron ramas paralelas y el merge se quedó con la plantilla de una y el código de la otra. El mismo merge revirtió `onboard` de 722 a 295 líneas —discovery de módulos, descenso por capas, raíces Python, H14/H16/H17— y `validate` perdió el aviso de H15. Aparte, #138 borró `read_spec`, `list_requirements` y `update_traceability` y renombró las otras cuatro, dejando 14 tests rojos en `main`. Regla que sale de aquí: **una rama larga que reescribe ficheros que otra rama está tocando se rebasa antes de mergear, o el merge borra trabajo sin conflicto**. `git` no avisa cuando el borrado es "el otro lado reescribió el fichero entero" |
| 2026-09-01 | El paquete npm lleva scope: `@rsaglobaltech/specgate`, no `specgate` (D21) | El publish de 0.8.0 devolvió `403 ... You may not perform that action with these credentials` sobre `PUT /specgate`, que parece un problema de token y no lo es: el `NPM_TOKEN` es classic/automation sin restricción de paquetes y publica `create-spec-driven-app` sin quejarse. npm compara los nombres nuevos **quitando la puntuación**, y `spec-gate` —publicado el 2026-03-03, "AI spec validation for Claude Code"— normaliza exactamente a `specgate`, así que el registry le niega el nombre a todo el mundo. Los nombres con scope quedan fuera de esa regla. Se elige la org, no una cuenta personal, porque es la coordenada que el paquete **ya tiene** en GitHub Packages: una sola ortografía en los dos registries. Apéndice fechado en ADR-0024 |
| 2026-09-01 | **Un `npm view <nombre>` que devuelve 404 no significa que el nombre esté libre** (D22) | ADR-0024 comprobó la disponibilidad de `specgate` así y lo leyó como «libre». 404 significa *no publicado*, nunca *creable*, y ambos difieren para cualquier nombre a un signo de puntuación de otro que exista. `npm publish --dry-run` tampoco lo detecta: no contacta con el registry. Regla: **un nombre se comprueba intentando publicarlo de verdad**. Anotada en `docs/release-process.md` |
| 2026-09-01 | El publish a npm de 0.8.1 dio **404 sobre el scope** hasta regenerar el token (D23) | `404 Not Found - PUT /@rsaglobaltech%2fspecgate`. Ya no era el bloqueo de nombre —eso lo resolvió el scope— sino que npm responde 404 en vez de 403 cuando la credencial no puede escribir en un scope, para no revelar si existe. Añadir a `rtexido` como owner de la org **no bastó**: el token viejo seguía sin alcance sobre el scope. Con un `NPM_TOKEN` nuevo, el mismo job sobre `v0.8.1` publicó sin cambiar versión ni tag. Lección: **404 al publicar un paquete con scope se lee como problema de credencial, no de paquete inexistente** |
| 2026-09-01 | Tras publicar, el packument tardó ~10 min en replicar y `npx` daba 404 mientras tanto (D24) | El job imprimió `+ @rsaglobaltech/specgate@0.8.1` y firmó la procedencia, pero `GET /@rsaglobaltech%2Fspecgate` seguía en 404 mientras el documento de versión, el tarball y el buscador ya respondían 200. `npm` y `npx` resuelven por la raíz del packument, así que la instalación estuvo rota un rato con el publish ya hecho. **Un publish con éxito no es una release verificada**: la comprobación que vale es `npx <pkg>@<version> --help`, que es la que `docs/release-process.md` ya manda hacer |
| 2026-09-01 | Se cierran `C9-05`, el default `layered` y `linkBack` como **decididos que no**, no como pendientes (D25) | Los tres llevaban abiertos como preguntas sin responder, que es el peor estado: no son trabajo pendiente, son decisiones que nadie tomaba. **Telemetría**: Specgate no recoge nada, dicho en positivo porque «aún no hay telemetría» y «esta herramienta no informa sobre ti» se leen distinto para quien mete la puerta en su CI. **Default `layered`**: el defecto *es* el argumento, y cambiarlo no quita una opinión, la cambia — rompiendo cada proyecto generado y gastando un major en el cambio; `--var ARCHITECTURE=layered` ya hace lo que pedía el issue, por proyecto y sin release. **`linkBack`**: una spec vive en una ruta de un repositorio, no en una URL, e inventar una por proveedor es una suposición que el puerto no debe hacer. Revisión completa de los 16 issues abiertos contra el disco: de los otros 13, **ninguno** era cerrable — la funcionalidad sencillamente no existe |
| 2026-09-01 | El sitio de documentación se rediseña sobre la arquitectura de `platform.claude.com/docs`, no sobre su marca (D26) | Se copia lo que es patrón —tres columnas con sidebar plegable y TOC pegajoso, paleta `⌘K`, y un vocabulario de componentes (tabs, steps, cards, callouts)— y **no** la identidad: wordmark, paleta y tipografía siguen siendo de Specgate, porque una documentación que parezca publicada por Anthropic es un problema distinto de una documentación que se lea bien. Los componentes se escriben como comentarios HTML con prefijo `csda:`, igual que los diagramas, para que los `.md` se sigan leyendo en GitHub; una directiva sin cerrar **rompe el build**, porque una sección que desaparece en silencio no la encuentra nadie. El resaltado de sintaxis es propio y en tiempo de build: una librería sería una dependencia más que auditar en cada SBOM, y el cliente no necesita un parser para leer texto estático |
| 2026-09-01 | El contrato de write-scope de MCP se impone **antes** de la llamada, no después (D27) | El harness lo verifica desde 0.7.0 diffeando el worktree al terminar. MCP no puede: cuando una herramienta retorna, el fichero ya está escrito. Así que se rechaza antes, con la lista declarada en `surface.ts` (`editsContract`, 18 comandos) y calculada una sola vez — el registro MCP se genera de ahí, así que no hay segunda lista que mantener. Dos exenciones razonadas: `change *`, que es *cómo* se edita una spec a propósito, y `update_traceability`, que solo añade filas y devuelve `updated:false` si ya existe — el mismo argumento por el que `WriteScope` exime los ficheros nuevos. La escotilla vive en `.csda/config.json`, nunca en la llamada: si el agente pudiera mandarla, el guard sería otra frase que ignorar, que es justo lo que sustituye. C10-04 cierra la fase 10 |
| 2026-09-01 | Dos tests del harness fallan de forma intermitente en ubuntu/Node 22 y se abre issue en vez de convivir con ello (D28) | Dos PRs seguidos, dos tests **distintos**, mismo runner, verdes al relanzar sin tocar código; verdes siempre en macOS, Windows y Node 24. Ambos miden reloj —`--budget-seconds` y el techo de paralelismo—. Se anota como [#158](https://github.com/rsaglobaltech/specgate/issues/158) porque el argumento entero de este repositorio es que una puerta verde significa algo: una suite que se pone roja por motivos ajenos al cambio enseña a pulsar «re-run», y después de eso también se pulsa sobre un fallo real. Es el mismo modo de fallo que una puerta que aprueba lo que no comprobó, llegando por el otro lado |
| 2026-09-01 | Todo PR va contra `develop`; `main` solo recibe develop en verde (D29) | `main` es la rama de la que sale la release y la primera que mira quien evalúa el proyecto, y ese día estuvo roja el rato que tardó en verse — una carrera de `git worktree add` bajo `--concurrency` que un escalón en develop habría atrapado antes de aterrizar. CI pasa a correr también en push a `develop`: sin eso, «verde en develop» sería una suposición y no algo comprobado, porque un merge que entra limpio puede romper una suite que ninguna de las dos ramas rompía por separado. Escrito en `CONTRIBUTING.md` y en `docs/release-process.md`, porque una regla de flujo que solo vive en la cabeza de alguien la rompe el siguiente en su primer PR |
| 2026-09-01 | Los precedentes en el prompt se limitan al mismo contexto acotado y a `Verified` (D2 / #106) | El prompt era **normativo** de principio a fin: hechos, Gherkin, `AI_RULES.md`, definición de hecho. Ningún ejemplo. Un agente sin historial nunca ha visto qué aspecto tiene una implementación aceptada *aquí*, así que se inventa un estilo y el siguiente intento se gasta en corregirlo. Tres reglas evitan que la sección haga daño: **mismo contexto acotado** (uno de otra parte enseña convenciones que no aplican, con la autoridad de haber sido aceptado), **`Verified` y no `Implemented`** (uno dice que el código existe, el otro que alguien lo comprobó) y **solo un requisito anterior**. La sección dice con todas las letras que es ejemplo de *forma* y no de comportamiento. Apagado por defecto: cuesta presupuesto de prompt y no dice nada hasta que el proyecto tiene trabajo aceptado que enseñar |
| 2026-09-02 | Los dos agujeros del spike se cierran **antes** de mover la versión (D34 / #167, #168) | Ambos son la misma familia: una puerta que aprueba lo que no comprobó, que es exactamente lo que este producto promete impedir. Sacar una 0.9.0 con los dos abiertos y ya públicos en el tracker era peor que tardar un día. Ninguno se arregló por la vía obvia: proteger `package.json` entero habría bloqueado añadir una dependencia, y exigir cobertura de escenarios en `--strict-tdd` habría roto a todo proyecto con features de varios escenarios. Uno compara **un valor**; el otro va detrás de bandera propia |
| 2026-09-02 | **`--by-scenario` no se construye** (D33 / #105) | El propio issue pedía spike antes que diseño, y la medida no respalda la interfaz: 4 invocaciones de agente y 229 s frente a 1 y 89 s para el mismo requisito, con 2,5× de contexto en agregado porque `AI_RULES.md` se repite en cada paso. El beneficio prometido —localizar el fallo— ya existe: el agente nombra sus tests con el id del escenario, y `previousFailure` arrastra la salida entera del gate. Lo único cierto de la queja es que `.harness/runs/*.json` anota `endedAt: "gate"` sin decir qué escenario, y eso es una fila en el registro. **Lo que el spike sí compró son H25 y H26**, ambos reproducidos. Detalle en `mejoras/spike-105-by-scenario.md` |
| 2026-09-01 | La ronda 1 de adopción simulada **encuentra tres defectos y no cierra G3** (D32 / GATE-G6) | Tres agentes en frío, tres stacks, aislamiento comprobado por `grep` y no supuesto. Los tres corrompieron la matriz en cinco minutos con los comandos que la propia herramienta recomienda: H22, H23, H24, los tres reproducidos aquí con un test que falla antes de arreglarse. Lo que **no** compra: ninguno tenía plazo real, equipo ni nada en juego, y los orquesté yo — así que hereda mis suposiciones por el prompt y por la elección de dominio. #100 sigue abierto y gobierna la 1.0. **Fallo propio del experimento**: lancé las tres en paralelo en la misma máquina, aisladas del repositorio pero no entre sí, y una observación (matriz de Express dentro de Flask) no reproduce y no se puede atribuir. La ronda 2 corre secuencialmente. Detalle en `mejoras/sim-round-1-assessment.md` |
| 2026-09-01 | La verificación adversarial produce **evidencia**, no opinión, y nunca decide (D3 / #107) | El revisor asesor que ya existe devuelve prosa; un adversario devuelve un test, y un test falla o no falla — uno es un argumento, el otro evidencia. Corre una sola vez por requisito, **tras** la puerta verde y **tras** el commit, y sus escrituras se descartan. Un sondeo que rompe es un aviso registrado y jamás un veredicto: un adversario siempre puede afirmar algo que el requisito nunca prometió, así que dejarle fallar la ejecución bloquearía trabajo correcto y lo convertiría en un segundo juez. El perfil debe declarar `advisory: true`. **Bug propio anotado**: la primera versión corría el sondeo antes del commit, así que `git status` mostraba el trabajo sin comitear del implementador y descartar «lo que escribió el sondeo» se llevaba la implementación — pase verde sobre una rama vacía, la familia H19 exacta. Test de regresión añadido |
| 2026-09-01 | La adopción simulada por agentes se registra como `GATE-G6` y **no cierra `GATE-G3`** (D31) | No hay todavía nadie de fuera que use la herramienta, y la propuesta es sustituirlo por agentes que simulen una empresa. Merece la pena: los cuatro defectos de los pilotos previos —H14, H15, H16, H17— son exactamente los que encuentra alguien sin el mapa del autor en su primera tarde, y hay una lista medida esperando (tres nombres distintos para la herramienta entre `case-1.md`, `getting-started.md` y `mejoras/`; un `cp examples/…` que supone un checkout que quien usa `npx` no tiene; el harness sin mencionar en ninguna guía de entrada). Pero G3 no compra «que funcione»: compra **independencia de las suposiciones del autor** y la señal de que alguien con algo en juego sigue usándola. Un agente que yo orquesto hereda mis suposiciones por el prompt, y no se cansa, ni tiene política, ni abandona por frustración — lo más ruidoso que dice un adoptante real. Cerrar G3 con esto sería una puerta que aprueba lo que no comprobó, aplicado a nuestra propia puerta de release. Detalle en [ADR-0025](../docs/specs/adr/0025-simulated-adoption-is-not-external-adoption.md) |
