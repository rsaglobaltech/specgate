# Historial de defectos de Specgate

Cada defecto de la herramienta encontrado usándola de verdad, en orden de
hallazgo. Se añade una fila en cuanto se detecta, aunque aún no tenga
arreglo, y se actualiza al cerrarlo.

- **Origen:** dónde apareció (golden_app = piloto Golden State Reinforcing,
  ver [`golden-app-evaluation.md`](golden-app-evaluation.md)).
- **Arreglo:** versión publicada que lo corrige, o `abierto`.
- **Test:** el test de regresión que lo fija (casi todos en
  `tests/unit/golden-eval.test.ts`).

Lo que **no** es defecto de Specgate (errores de mis packs, decisiones de
diseño) va al final, separado, para que el historial no se infle.

## Defectos

| # | Fecha | Origen | Síntoma | Causa | Arreglo |
|---|---|---|---|---|---|
| 1 | 2026-10-07 | golden_app, adopción | `pack lint --strict` daba por no referenciados requisitos cubiertos solo por escenarios | leía `scenario.requirement`; el esquema dice `requirement_id` | 0.14.1 |
| 2 | 2026-10-07 | golden_app, packs | El lector YAML rechazaba lo que escriben las librerías YAML | sin soporte de listas sin sangría, escalares plegados ni comillas escapadas | 0.14.1 |
| 3 | 2026-10-07 | golden_app, packs | "tag work" marcado como paso vago | la regex de pasos vagos casaba la palabra suelta | 0.14.1 |
| 4 | 2026-10-07 | golden_app, adopción | Una matriz generada rechazaba un requisito con dos escenarios | regla de duplicados pensada para un escenario por requisito | 0.14.1 |
| 5 | 2026-10-07 | golden_app, packs | Expandir una plantilla que ya trae `@REQ @SCN` daba error | el etiquetado no reconocía tags existentes | 0.14.1 |
| 6 | 2026-10-07 | release | Los push a `main` nunca los rechazaba GitHub | en zsh `$R:refs/…` aplica el modificador `:r`; hay que escribir `"${R}:refs/heads/main"` | 0.14.1 (docs) |
| 7 | 2026-10-07 | golden_app, `specops add` | Instalar un pack devolvía la matriz a mantenimiento manual; `matrix --migrate` escribía 47 secciones de relleno | expand escribía filas en vez de campos de traza | 0.14.2 |
| 8 | 2026-10-07 | golden_app | Requisitos de capacidad con una sola fila sin escenarios | `deriveRows` no expandía escenarios de capability specs | 0.14.2 |
| 9 | 2026-10-07 | golden_app, harness | El prompt decía "no text — stop" para todo requisito de pack | solo leía `spec.md`, no las capability specs; mostraba un escenario de varios | 0.14.2 |
| 10 | 2026-10-07 | golden_app, harness | Un requisito con dos escenarios se ejecutaba dos veces | una ejecución por fila del plan, no por requisito | 0.14.2 |
| 11 | 2026-10-07 | golden_app, harness | Worktree sin dependencias: el gate fallaba sin `npm ci` | no existía `setup_cmd` | 0.14.2 |
| 12 | 2026-10-07 | golden_app, CI | El CI no podía leer packs privados | sin `SPECOPS_TOKEN` ni pista `pack_unavailable` | 0.14.2 |
| 13–19 | 2026-10-07 | golden_app, adopción | Fricciones menores de adopción y documentación (ver informe en chat de ese día) | varias | 0.14.1 / 0.14.2 |
| 21 | 2026-10-07 | golden_app, packs | `depends_on` entre packs distintos no se soporta | el grafo de dependencias es por pack | **abierto** |
| 22 | 2026-10-07 | golden_app, `specops add` | `aggregates.md`, `events.md`… solo listaban el último pack | cada pack reescribía el catálogo entero | 0.14.3 |
| 23 | 2026-10-07 | golden_app, `specops sync` | "CONFLICT (no merge base)" en `traceability.md` | sync renderizaba en un directorio vacío; con matriz derivada debe regenerarla | 0.14.3 |
| 24 | 2026-10-07 | golden_app, `specops sync` | El lock pasó a v0.1.2 pero `depends_on` no llegó a ningún requisito | la línea `csda:trace` se fusionaba como texto y ganaba la local ("kept") | 0.14.3 |
| 26 | 2026-10-07 | golden_app, `plan` | Un artefacto con varios ficheros contaba como inexistente | se buscaba la celda entera como una sola ruta | 0.14.3 |
| 27 | 2026-10-07 | golden_app, `plan` | Filas duplicadas y escenarios perdidos | `byId` guardaba un ítem por requisito | 0.14.3 |
| 28 | 2026-10-08 | golden_app, packs | 16 de 46 requisitos sin escenario y `pack lint` no dijo nada | ninguna comprobación de cobertura de escenarios | 0.14.3 (nota de lint) |
| 29 | 2026-10-08 | golden_app, harness | La línea base de `adopt` se planificaba como trabajo para siempre | `npm test` / `existing codebase` no son rutas | 0.14.3 |
| 30 | 2026-10-08 | golden_app, `specops sync` | Sync sin cambios reescribe `expanded_at` en el lock: diff ruidoso | timestamp escrito siempre | **abierto** |
| 32 | 2026-10-08 | golden_app, packs v0.2.0 | `status` "99/99 done" con 52 escenarios nuevos sin test | el test se enlazaba por requisito: cada escenario heredaba los del requisito | 0.14.4 |
| 33 | 2026-10-08 | golden_app, harness | "plan produced invalid JSON" | `plan` llamaba a `process.exit(0)` antes de vaciar stdout; en pipe se cortaba a 65.536 bytes | 0.14.4 (`plan`); **abierto** en otros 28 comandos |
| 34 | 2026-10-08 | golden_app, CI | `validate --against-lock` marcó 30 requisitos como desviados con todos sus escenarios presentes | comparaba la primera fila con el primer escenario del pack | 0.14.5 |
| 35 | 2026-10-08 | golden_app, harness 2.ª ronda | Requisito en verde pero "push failed (stale info)" | `--force-with-lease` con la referencia de seguimiento obsoleta (rama ya borrada en el remoto tras el merge) | 0.14.6 |
| 37 | 2026-10-08 | golden_app, harness 2.ª ronda | REQ-302 rechazado dos veces por "tocar" `traceability.md` | la protección de escritura trataba como edición una matriz derivada idéntica a su regeneración | 0.14.6 |
| 38 | 2026-10-08 | piloto de `verify` con OpenSpec (antes de publicar) | El lector de OpenSpec ignoraba en silencio las capacidades anidadas (`specs/time-attendance/clock-punches/spec.md`) | la expresión regular aceptaba un solo segmento de ruta | rama `feat/verify-openspec`, antes de release |
| 36 | 2026-10-08 | CI de Specgate | El job de lint se colgó 6 h | `apt-get update` colgado en ShellCheck, sin timeout | `ci.yml` (#242) |

## No son defectos de Specgate

| # | Qué | Por qué no |
|---|---|---|
| 20 | Packs sin `depends_on` | error de autoría de mis packs (v0.1.2) |
| 25 | El harness commitea `.specops/harness-prompts/` | diseño: es el registro de auditoría |
| 31 | 48/48 "done" sin API ni pantallas | la spec no las pedía; resuelto con packs v0.2.0. **Lección:** "done" significa que se cumple la spec, no que el producto funcione. La idea `specgate draft` con checklist nace de aquí |
