# Estado de la plataforma Specgate

**Fecha:** 2026-10-11 · **Versión publicada:** `0.17.10` (npm
`@rsaglobaltech/specgate`) · **`main` = `develop` = `97cfeaa`**

Foto de dónde está todo al cerrar la sesión del rediseño de la web. Para el
backlog vivo, [`plan-cierre-enterprise.md`](plan-cierre-enterprise.md); para
los defectos, [`specgate-defectos.md`](specgate-defectos.md).

---

## 1. Resumen en cinco líneas

1. **Producto:** CLI `specgate` 0.17.10, sin dependencias en tiempo de
   ejecución, licencia MIT, repositorio público `rsaglobaltech/specgate`.
2. **Probado en seis productos** construidos por un agente desde fichas de
   cliente reales: 229 requisitos entregados, 2 esperando respuesta a propósito.
3. **Web publicada** en <https://rsaglobaltech.github.io/specgate/> con la
   landing nueva, el quickstart por fases y la comparación con OpenSpec.
4. **Siete packs probados** sacados de los pilotos, más once de ejemplo.
5. **Abiertos:** defectos #84–#92 (ninguno bloquea; ver §7).

---

## 2. El producto

| Pieza                        | Estado                                                                                                                                     |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| CLI                          | 30 comandos. Bucle diario: `status` → `new` → test que nombra el requisito → `done` → `check`                                              |
| De ficha a especificación    | `change new` + `draft --check` (D1–D12; D6 detecta valores que la ficha no dice) + `change archive`                                        |
| Preguntas abiertas           | `Needs Clarification` bloquea el harness y `done` hasta que alguien responde                                                               |
| Puerta                       | `check` = `validate --strict` + la suite del proyecto (`test_cmd` en `harness.config.yaml`)                                                |
| Harness                      | `harness run`: un worktree y una rama por requisito, la puerta tras cada intento, reintentos con los fallos en el prompt, nunca hace merge |
| Informe                      | `report` → HTML de cobertura para el product owner                                                                                         |
| Adopción de código existente | `onboard` / `init` (adopta sin tocar código; propone capacidades desde los ficheros de build); `--monorepo`                                |
| OpenSpec                     | `verify` lee `openspec/` sin escribir y falla si un cambio archivado reclama un escenario que ningún test nombra                           |
| Agentes                      | 10 herramientas (`agents init --tool …`), servidor MCP, servidor de lenguaje                                                               |
| CI                           | `ci init` escribe el job para GitHub, GitLab, Azure o Jenkins                                                                              |

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
- Defectos al instalarlos: #84–#86 (§7).

---

## 5. Web y documentación

**Publicada** en <https://rsaglobaltech.github.io/specgate/> (95 páginas).

| Parte      | Qué hay                                                                                                                                                                                                                                                                                                                                                                                           |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Landing    | Hero animado (la tarifa inventada que `draft --check` detecta) · cifras de los pilotos · **viaje por fases** con selector desde cero / proyecto existente · seis fortalezas · tres grabaciones reales con pestañas · seis tarjetas de proyecto con imagen · galería de pantallas · informe de HealthTech · diagrama del harness · **"OpenSpec records what was done. Specgate proves it."** · FAQ |
| Quickstart | `getting-started.md` (entrada) + `docs/start/scratch-1…5` y `existing-1…5`, una página por fase con la salida real                                                                                                                                                                                                                                                                                |
| Proyectos  | `docs/projects/index.md` + una página por piloto                                                                                                                                                                                                                                                                                                                                                  |
| OpenSpec   | `vs-openspec.md` (contrastado con OpenSpec v1.14.1) y `openspec.md` (`verify`)                                                                                                                                                                                                                                                                                                                    |

**Lo que mantiene la web honesta (tests en `tests/unit/`):**

- `docs-terminal`: las tres grabaciones de la landing salen del CLI real
  (`npm run docs:terminal`, `docs:terminal:check`).
- `docs-journey`: las salidas de las guías por fases se graban
  (`npm run docs:journey`, `docs:journey:check`), y cada comando u opción
  que se pide escribir existe en su `--help`.
- `docs-site`: cifras de la landing = tabla de proyectos, sin páginas
  huérfanas, frases clave.
- `docs-truth`: ninguna guía supera 300 líneas.

**Publicar:** merge a `main` con cambios en `docs/**` → `pages.yml` despliega
(unos 40 s).

---

## 6. Flujo y CI

- **Develop primero:** todo PR va a `develop`; `main` recibe `develop` en verde
  por fast-forward (`git push origin "${R}:refs/heads/main"`); las releases
  salen de `main`.
- **GitHub Actions desactivadas** en `rsaglobaltech` desde 2026-10-11 por
  cuota (lista en `~/sandbox/workflows-desactivados.tsv`). **Excepción:**
  `pages.yml` de specgate, reactivado (repo público, no gasta cuota).
- **Sin CI, se verifica en local** antes de cada merge, y se dice en el PR:

```bash
npm run build && npm run test:unit && npm test
npm run lint && npm run format:check
npm run docs:terminal:check && npm run docs:journey:check
node dist/scripts/docs/build-site.js   # escribe _site/; borrarlo después
```

Última verificación (2026-10-11): 1391/1391 unitarios, 66/66 CLI, lint y
formato limpios, grabaciones y guías al día, 95 páginas sin huérfanas.

---

## 7. Defectos abiertos

Detalle en [`specgate-defectos.md`](specgate-defectos.md).

| #   | Qué                                                                                                 | Dónde            |
| --- | --------------------------------------------------------------------------------------------------- | ---------------- |
| 83  | Idea: D11 reservado                                                                                 | `draft --check`  |
| 84  | Un pack con `Needs Clarification` se instala con la fila en `Draft`: la pregunta se pierde          | packs            |
| 85  | `status` cuenta filas, no requisitos, con varios escenarios por requisito                           | `status`         |
| 86  | `init --from-pack` con dos escenarios por requisito duplica filas en la matriz manual               | `init`           |
| 87  | D6 trocea fechas y horas en varios números                                                          | `draft --check`  |
| 88  | D6 no mira el texto del requisito, solo los escenarios                                              | `draft --check`  |
| 89  | `report` pinta `Needs Clarification` como "Test missing"                                            | `report`         |
| 90  | `report` no muestra el título del requisito                                                         | `report`         |
| 91  | En un proyecto recién creado, `init` lo trata como adopción y deja `REQ-001` pendiente para siempre | `init`           |
| 92  | `change archive` dice que `validate --strict` fallará, y pasa                                       | `change archive` |

**Sugerencia de orden:** #91 y #92 (los ve todo usuario nuevo en el
quickstart), luego #89 y #90 (el informe que enseñamos en la landing), luego
#87 y #88 (ruido y huecos de D6), y #84–#86 (packs).

---

## 8. Otros repositorios

- **forja** (`~/WebstormProjects/forja-cli`, `rsaglobaltech/forja`, privado):
  generador de proyectos 0.2.0 con Spring Boot/Quarkus, web, OAuth2, ArchUnit
  y Specgate.
- **Pilotos:** en `~/sandbox/learn-ai-architectures/spec-driven-ai-demo/`
  (`golden_app`, `reservas-app`, `credito-tienda`, `fincore`, `eventtech`,
  `healthtech`), cada uno con su bitácora en `docs/bitacora/`.

---

## 9. Cómo retomar

1. `git fetch` y comprobar que `main` = `develop`.
2. Leer §7 y elegir defecto; anotarlo como cerrado en `specgate-defectos.md` en
   el mismo PR que lo arregla, con su test de regresión.
3. Si un arreglo cambia la salida del CLI: `npm run docs:terminal` y
   `npm run docs:journey` para regenerar la web, y revisar el diff.
4. Verificar en local (§6), PR a `develop`, fast-forward a `main`, y release
   desde `main` si toca publicar en npm.
