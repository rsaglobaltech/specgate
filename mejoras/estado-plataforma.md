# Estado de la plataforma Specgate

**Fecha:** 2026-10-12 · **Versión publicada:** `0.18.0` (npm
`@rsaglobaltech/specgate`, `latest`) · **`main` = `develop` = `ccf93e9`**

Foto de dónde está todo: Specgate (producto, web, documentación) y agentkit (la
herramienta privada para el trabajo). Para el backlog vivo,
[`plan-cierre-enterprise.md`](plan-cierre-enterprise.md); para los defectos,
[`specgate-defectos.md`](specgate-defectos.md).

---

## 1. Resumen

1. **Producto:** CLI `specgate` 0.18.0, sin dependencias en tiempo de ejecución,
   licencia MIT, repositorio público `rsaglobaltech/specgate`. Novedad de la
   0.18: **`specgate draft`**, de un plan o ficha a requisitos, guiado.
2. **Probado en seis productos** construidos por un agente desde fichas de
   cliente reales: 229 requisitos entregados, 2 esperando respuesta a propósito.
3. **Web publicada** en <https://rsaglobaltech.github.io/specgate/> con el
   diseño **Monolith** (grafito/papel y naranja), el viaje por fases, el
   showcase del harness y la comparación con OpenSpec.
4. **Siete packs probados** sacados de los pilotos, más once de ejemplo.
5. **agentkit** (privado): preparar el repositorio del trabajo para agentes de
   IA con OpenCode. Fases 1 y 2 hechas; falta probar en Windows y con datos
   reales (§9).
6. **Abiertos en Specgate:** defectos #83–#91 y #96–#102 (ninguno bloquea; §7).

---

## 2. El producto

| Pieza                        | Estado                                                                                                                                                                                                                                                                                       |
| ---------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| CLI                          | 30 comandos. `--help` muestra seis para empezar: `init`, `draft`, `status`, `new`, `check`, `done`. Bucle diario: `status` → `new` → test que nombra el requisito → `done` → `check`                                                                                                         |
| De plan o ficha a requisitos | **`specgate draft`**: sin ficha explica qué es y `--new-brief` escribe una plantilla; sin cabecera explica cada campo (`product`, `surfaces`, `actors`, `modules`); con errores dice cuál y cómo arreglarlo; con cabecera válida lista los módulos y dice el siguiente                       |
| Un módulo                    | `specgate draft <módulo>` abre el cambio enlazado a la ficha y escribe `DRAFTING.md`; `--agent "claude -p"` llama al agente (sin `{prompt_file}`), deshace lo que escriba fuera del borrador y lo comprueba; volver a ejecutarlo comprueba (D1–D12) y dice qué falta o que se puede archivar |
| Agente desde Claude Code     | `/specgate:draft`, instalado por `agents init`                                                                                                                                                                                                                                               |
| Preguntas abiertas           | `Needs Clarification` bloquea el harness y `done` hasta que alguien responde                                                                                                                                                                                                                 |
| Puerta                       | `check` = `validate --strict` + la suite del proyecto (`test_cmd` en `harness.config.yaml`)                                                                                                                                                                                                  |
| Harness                      | `harness run`: un worktree y una rama por requisito, la puerta tras cada intento, reintentos con los fallos en el prompt, nunca hace merge; `harness report` da el coste                                                                                                                     |
| Informe                      | `report` → HTML de cobertura para el product owner                                                                                                                                                                                                                                           |
| Código existente             | `onboard` / `init` (adopta sin tocar código; propone capacidades desde los ficheros de build); `--monorepo`                                                                                                                                                                                  |
| OpenSpec                     | `verify` lee `openspec/` sin escribir y falla si un cambio archivado reclama un escenario que ningún test nombra                                                                                                                                                                             |
| Agentes                      | 10 herramientas (`agents init --tool …`), servidor MCP, servidor de lenguaje                                                                                                                                                                                                                 |
| CI                           | `ci init` escribe el job para GitHub, GitLab, Azure o Jenkins                                                                                                                                                                                                                                |

**Publicación:** npm 0.18.0 (`latest`, con procedencia firmada) y release
<https://github.com/rsaglobaltech/specgate/releases/tag/v0.18.0>. La imagen
Docker sigue en **0.17.10** (su workflow está apagado).

---

## 3. Los seis pilotos

Todos construidos por un agente que usaba Specgate, desde fichas de cliente
reales. No son despliegues de cliente y el código es privado. En la web, cada
uno tiene su página en `docs/projects/`.

| Nombre público | Repositorio      | Stack                    | Requisitos                                                 | Tests | Informe                                                    |
| -------------- | ---------------- | ------------------------ | ---------------------------------------------------------- | ----- | ---------------------------------------------------------- |
| Rebar Crew     | `golden_app`     | Expo + Next.js + TS      | 47/47                                                      | 599   | [golden-app-informe-final.md](golden-app-informe-final.md) |
| Bookings       | `reservas-app`   | Next.js + TS             | 38/38                                                      | 212   | [reservas-app-piloto.md](reservas-app-piloto.md)           |
| Credit shop    | `credito-tienda` | Next.js + TS             | 24/24                                                      | 272   | [credito-tienda-piloto.md](credito-tienda-piloto.md)       |
| FinCore        | `fincore`        | Spring Boot 3.3, Java 21 | 59/60 (REQ-055 espera respuesta legal)                     | 112   | [fincore-piloto.md](fincore-piloto.md)                     |
| EventTech      | `eventtech`      | Quarkus 3.40, Java 21    | 38/38                                                      | 71    | [eventtech-piloto.md](eventtech-piloto.md)                 |
| HealthTech     | `healthtech`     | Quarkus 3.40, Java 21    | 23/24 (REQ-020 interacciones, sin regla clínica inventada) | 35    | [healthtech-piloto.md](healthtech-piloto.md)               |

En público, "Golden State" se llama **Rebar Crew** y no aparecen nombres de
cliente. Las capturas de las apps usan datos inventados.

---

## 4. Packs

- **Probados (tier `proven`, con `metadata.provenance`):** ledger, transfers,
  event-registration, clinical-record, appointment-booking, shop-orders,
  time-attendance. Esquema de pack 1.5.0; `tests/unit/proven-packs.test.ts`.
- **Ejemplos (tier `starter`):** los once anteriores (auth, billing,
  notifications, …), etiquetados como tal en `docs/domain-packs.md`.
- Recorrido completo y verificado: `docs/packs-end-to-end.md`.
- Defectos al instalarlos: #84–#86 y #96–#98 (§7).

---

## 5. Web y documentación

**Publicada** en <https://rsaglobaltech.github.io/specgate/> (94 páginas),
diseño **Monolith**: grafito `#0d0e11` / papel `#f3efe8`, naranja `#ff5b1f`,
Syne + IBM Plex Sans + IBM Plex Mono, tema oscuro y claro con tokens,
contraste comprobado, sin animaciones con "reducir movimiento".

| Parte      | Qué hay                                                                                                                                                                                                                                                                                                                                                                                 |
| ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Landing    | Hero "No test, no done." con la pila isométrica 3D (se inclina hacia el ratón, se abre en capas con el scroll y con la leyenda) · banda de palabras · pipeline · viaje en pilares (desde cero / proyecto existente) · tres grabaciones reales · bento de proyectos con el 229 · **showcase del harness** (una ejecución paso a paso, cifras reales, diagrama de flujo) · OpenSpec · FAQ |
| Empezar    | `getting-started.md` · **`start/write-the-brief.md`** · `start/scratch-1…5` y `existing-1…5` (una página por fase, salida real grabada) · `quickstart.md`                                                                                                                                                                                                                               |
| Proyectos  | `docs/projects/index.md` + una página por piloto                                                                                                                                                                                                                                                                                                                                        |
| OpenSpec   | `vs-openspec.md` (contrastado con OpenSpec v1.14.1) y `openspec.md` (`verify`)                                                                                                                                                                                                                                                                                                          |
| Advanced   | Tutorial (flujo actual) · Choosing your agent · How-to · Supply chain · **Releases & deployment** · Specs that cannot lie. Retirados: Bootstrap prompt y Walkthrough (→ `packs-end-to-end.md`)                                                                                                                                                                                          |
| Brownfield | `case-studies/case-1.md`, reescrito para 0.18 con un servicio inventado y todos los comandos ejecutados de verdad                                                                                                                                                                                                                                                                       |

**Lo que mantiene la web honesta (tests en `tests/unit/`):**

- `docs-terminal`: las tres grabaciones de la landing salen del CLI real
  (`npm run docs:terminal`, `docs:terminal:check`).
- `docs-journey`: las salidas de las guías por fases se graban
  (`npm run docs:journey`, `docs:journey:check`).
- **`docs-commands`**: cada `specgate <comando> --opción` de las guías existe en
  el `--help` de ese comando (excepciones conocidas en `UNLISTED`, #100).
- `docs-site`: cifras de la landing = tabla de proyectos, sin páginas
  huérfanas, frases clave, diagramas con tokens.
- `docs-truth`: ninguna guía supera 300 líneas.

**Publicar:** merge a `main` con cambios en `docs/**` → `pages.yml` despliega
(unos 40 s).

---

## 6. Flujo y CI

- **Develop primero:** todo PR va a `develop`; `main` recibe `develop` en verde
  por fast-forward (`git push origin "${R}:refs/heads/main"`).
- **GitHub Actions desactivadas** en `rsaglobaltech` desde 2026-10-11 por
  cuota (lista en `~/sandbox/workflows-desactivados.tsv`). **Excepción:**
  `pages.yml` de specgate, siempre activo (repo público).
- **Release a npm:** reactivar `publish-npm.yml`, etiqueta `vX.Y.Z` sobre
  `main`, esperar (E2E en tres sistemas + `test:all`, ~4 min), volver a
  desactivarlo, notas de release desde el changelog. Así salió la 0.18.0.
  Detalle en `docs/release-process.md` ("Releases & deployment").
- **Sin CI, se verifica en local** antes de cada merge, y se dice en el PR:

```bash
npm run build && npm run test:unit && npm test
npm run lint && npm run format:check
npm run docs:terminal:check && npm run docs:journey:check
node dist/scripts/docs/build-site.js   # escribe _site/; borrarlo después
```

Última verificación (2026-10-11, rediseño Monolith): 1417/1417 unitarios,
66/66 CLI, lint y formato limpios, grabaciones y guías al día, 94 páginas sin
huérfanas.

---

## 7. Defectos abiertos de Specgate

Detalle en [`specgate-defectos.md`](specgate-defectos.md). Cerrados en 0.18.0:
#92–#95.

| #   | Qué                                                                                                 | Dónde           |
| --- | --------------------------------------------------------------------------------------------------- | --------------- |
| 83  | Idea: D11 reservado                                                                                 | `draft --check` |
| 84  | Un pack con `Needs Clarification` se instala con la fila en `Draft`: la pregunta se pierde          | packs           |
| 85  | `status` cuenta filas, no requisitos, con varios escenarios por requisito                           | `status`        |
| 86  | `init --from-pack` con dos escenarios por requisito duplica filas en la matriz manual               | `init`          |
| 87  | D6 trocea fechas y horas en varios números                                                          | `draft --check` |
| 88  | D6 no mira el texto del requisito, solo los escenarios                                              | `draft --check` |
| 89  | `report` pinta `Needs Clarification` como "Test missing"                                            | `report`        |
| 90  | `report` no muestra el título del requisito                                                         | `report`        |
| 91  | En un proyecto recién creado, `init` lo trata como adopción y deja `REQ-001` pendiente para siempre | `init`          |
| 96  | Un pack añadido a un proyecto adoptado choca en `REQ-001`                                           | packs           |
| 97  | `sync` añade un id que ya existe en local, dice que todo va bien y luego `check` falla              | `specops sync`  |
| 98  | `sync` devuelve un requisito cerrado a "Ready to close"                                             | `specops sync`  |
| 99  | MODIFIED sobre un requisito creado con `new` duplica su escenario                                   | `change`        |
| 100 | Huecos en la ayuda: `validate --json`, `init --pack`, `plan --format`                               | `--help`        |
| 101 | Las propuestas de `init` mandan usar `req link`; `spec.md` inventa "REST" y "Domain: general"       | `init`          |
| 102 | `onboard` termina con "Next specgate adopt" en vez de `init`                                        | `onboard`       |

**Hallazgos de usar Specgate en agentkit** (en `agentkit/docs/specgate-findings.md`,
sin número todavía): no existe la superficie `cli` (obliga a escribir "the
developer sees"); dos borradores abiertos seguidos solapan los rangos de
escenarios; D9 confunde el `<0.91>` de JUnit con un hueco sin rellenar; D6 pide
la cadena exacta en `assumptions.md`; D4 pide un número en un requisito de
compatibilidad; `status` pide "a test and code" cuando `done` solo necesita el
test.

**Sugerencia de orden:** #91, #101 y #102 (los ve todo usuario nuevo) → la
superficie `cli` y el solape de escenarios (los ve todo el que usa
`specgate draft`) → #89 y #90 (el informe de la landing) → #87 y #88 (D6) →
#84–#86 y #96–#99 (packs y cambios) → #100 (ayuda).

---

## 8. Otros repositorios

- **forja** (`~/WebstormProjects/forja-cli`, `rsaglobaltech/forja`, privado):
  generador de proyectos 0.2.0 con Spring Boot/Quarkus, web, OAuth2, ArchUnit
  y Specgate.
- **Pilotos:** en `~/sandbox/learn-ai-architectures/spec-driven-ai-demo/`
  (`golden_app`, `reservas-app`, `credito-tienda`, `fincore`, `eventtech`,
  `healthtech`), cada uno con su bitácora en `docs/bitacora/`.

---

## 9. agentkit — la herramienta privada para el trabajo

**Qué es:** `@rsaglobaltech/agentkit`, repositorio **privado**
`rsaglobaltech/agentkit` (`~/WebstormProjects/agentkit`), sobre Specgate. Prepara
un repositorio grande ya existente para trabajar ticket a ticket con agentes de
IA en **OpenCode** (modelos de GitHub Copilot), gastando el mínimo de contexto
y de peticiones premium. No contiene nada de ninguna empresa: lo detecta del
repositorio o lo escribe el usuario en `agentkit.config.yaml`.

**Para qué stack:** monolito modular Spring Boot + Hibernate + Spring Data +
Oracle + **Flyway** + CIB seven (BPMN) + Angular; Maven; Jenkins + Sonar;
tests unitarios, de integración, de BPMN y Robot Framework (opcional por
ticket); Windows (PowerShell, Git Bash, WSL); Jira Cloud; ramas
`feature/<team>/<TICKET-NUM>` y `bugfix/<team>/<TICKET-NUM>`; tickets que a
menudo tocan el monolito y dos o más microservicios del mismo stack.

**Estado:** `main` = `develop` = `3a74214`; solo existen esas dos ramas.
Node ≥22, `npm test` 63/63, lint y formato limpios, `specgate check` en verde
(47/47 requisitos). Arquitectura: `core/` (lógica pura) + `cli/` + plugin de
OpenCode.

| Fase | Qué incluye                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     | Estado             |
| ---- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------ |
| 1    | `doctor` (máquina, consciente de Windows) · `init` (detecta módulos Maven, Angular, BPMN, Flyway y su numeración, Robot, Sonar, Jenkins; genera `agentkit.config.yaml`, `AGENTS.md` raíz y por módulo, `.ignore`, `opencode.json`; `--dry-run`, `--local-only`, `--refresh`) · `verify` (niveles fast/medium/full, `--only`, `--robot`; salida resumida a los fallos: 92 líneas de Maven → 8) · `next-migration` (Flyway)                                                                                                                       | Hecha (PR #1)      |
| 2    | **Perfil de equipo** (`extends:`, `team init`, `config --show` con el origen de cada valor) · **espacio de trabajo** (`workspace init`: repositorios hermanos y contratos OpenAPI, REST/Feign, topics, BPMN) · **`ticket <KEY>`** (Jira Cloud, misma rama en cada repositorio, resumen del ticket) · `verify --ticket` (orden proveedor → consumidor) · `ci-log` (Jenkins) · **OpenCode**: agentes `plan`/`build`, siete comandos, modo terse y el plugin (5 herramientas, salida resumida, bloquea editar `V__` existentes y rutas protegidas) | Hecha (PRs #2, #3) |
| 3    | Integración con Specgate: ticket → requisito, cerrado por los tests JUnit, BPMN o Robot que lo nombren                                                                                                                                                                                                                                                                                                                                                                                                                                          | Pendiente          |

**Lo que falta en agentkit:**

1. **Probar en Windows de verdad** (PowerShell, Git Bash y WSL): `npm test`,
   `doctor` (`core.longpaths`, `core.autocrlf`), `verify` con `mvnw.cmd`. Solo
   está cubierto por tests que simulan la plataforma.
2. **Jira con el token real** del usuario (`JIRA_EMAIL`, `JIRA_API_TOKEN` en el
   entorno): `agentkit ticket <ticket real> --dry-run`. Solo probado contra un
   Jira simulado.
3. **Una sesión real de OpenCode con Copilot:** el plugin carga y lista sus
   herramientas en la 1.18.35, pero sus hooks no han funcionado aún con un
   modelo de verdad.
4. **API v2 de plugins:** escrita según su documentación; la 1.18.35 no la
   ofrece entera, así que hoy funciona la v1.
5. **Publicar** en GitHub Packages (privado) para instalar con
   `npm i -g @rsaglobaltech/agentkit` y el plugin por nombre; hoy se instala
   desde un clon (`npm link`) y el plugin por ruta local.
6. **`extends:` desde una URL de git** (hoy solo rutas).
7. **Fase 3** (Specgate).
8. **Antes de usarla en el repositorio de la empresa:** confirmar la política
   interna; mientras tanto, `init --local-only` deja todo fuera de git.

---

## 10. Cómo retomar

**Specgate**

1. `git fetch` y comprobar que `main` = `develop`.
2. Leer §7 y elegir defecto; anotarlo como cerrado en `specgate-defectos.md` en
   el mismo PR que lo arregla, con su test de regresión.
3. Si un arreglo cambia la salida del CLI: `npm run docs:terminal` y
   `npm run docs:journey`, y revisar el diff.
4. Verificar en local (§6), PR a `develop`, fast-forward a `main`, y release
   desde `main` si toca publicar en npm (§6).

**agentkit**

1. Pedir al usuario el resultado de la prueba en Windows y arreglar lo que
   salga.
2. Después, Jira real y una sesión de OpenCode; luego publicar y la fase 3.
3. Mismo flujo: ramas de trabajo → PR a `develop` → `main`; borrar las ramas
   de trabajo al terminar (el usuario solo quiere `main` y `develop`).
