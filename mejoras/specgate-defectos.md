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
| 30 | 2026-10-08 | golden_app, `specops sync` | Sync sin cambios reescribe `expanded_at` en el lock: diff ruidoso | timestamp escrito siempre | 0.17.0: `expanded_at` solo cambia si cambia el pack (repo, versión, commit o vars) |
| 32 | 2026-10-08 | golden_app, packs v0.2.0 | `status` "99/99 done" con 52 escenarios nuevos sin test | el test se enlazaba por requisito: cada escenario heredaba los del requisito | 0.14.4 |
| 33 | 2026-10-08 | golden_app, harness | "plan produced invalid JSON" | `plan` llamaba a `process.exit(0)` antes de vaciar stdout; en pipe se cortaba a 65.536 bytes | 0.14.4 (`plan`); el resto con stdio bloqueante para todo comando, 0.16.0 |
| 34 | 2026-10-08 | golden_app, CI | `validate --against-lock` marcó 30 requisitos como desviados con todos sus escenarios presentes | comparaba la primera fila con el primer escenario del pack | 0.14.5 |
| 35 | 2026-10-08 | golden_app, harness 2.ª ronda | Requisito en verde pero "push failed (stale info)" | `--force-with-lease` con la referencia de seguimiento obsoleta (rama ya borrada en el remoto tras el merge) | 0.14.6 |
| 37 | 2026-10-08 | golden_app, harness 2.ª ronda | REQ-302 rechazado dos veces por "tocar" `traceability.md` | la protección de escritura trataba como edición una matriz derivada idéntica a su regeneración | 0.14.6 |
| 38 | 2026-10-08 | piloto de `verify` con OpenSpec (antes de publicar) | El lector de OpenSpec ignoraba en silencio las capacidades anidadas (`specs/time-attendance/clock-punches/spec.md`) | la expresión regular aceptaba un solo segmento de ruta | 0.15.0 (antes de publicar) |
| 39 | 2026-10-08 | revisión antes de publicar `verify` | Dos cosas se llaman "verify": el comando para agentes `/specgate:verify` (ejecuta el gate `check`) y el nuevo `specgate verify` (OpenSpec) | nombre elegido sin revisar los comandos que `agents init` ya escribe | `/specgate:verify` → `/specgate:check` (decisión del usuario), migrado por `specgate update`; 0.15.0 |
| 40 | 2026-10-08 | prueba real de la herramienta MCP `specgate_verify` | El servidor MCP rechazaba el proyecto OpenSpec: "Not a spec-driven project (no spec.md)" | toda herramienta exigía `spec.md`; un proyecto OpenSpec no lo tiene | 0.16.0 |
| 41 | 2026-10-09 | `status` con D4 sobre golden_app (antes de publicar) | D4 marcaba 4 de 4 requisitos no funcionales cualitativos (offline, privacidad, dispositivos) como "sin medida" | la regla exigía un número a todo requisito no funcional; la omisión real es prometer una cantidad ("rápido", "escalable") sin darla | 0.16.0 (antes de publicar) |
| 42 | 2026-10-09 | piloto reservas_app: `draft --check` sobre el primer borrador | D4 marcaba REQ-147 ("la página es responsive y usable desde 360 px") como no medido | "responsive" está en la lista de palabras de cantidad (pensada para *tiempo de respuesta*), y `px` no es una unidad para `MEASURE` | 0.17.1 |
| 43 | 2026-10-09 | piloto reservas_app: `draft --check` | 9 de 74 hallazgos D6 eran duplicados: un mismo valor dos veces en un escenario se informa dos veces | D6 recorre los valores de cada paso sin quitar repetidos por escenario | 0.17.1 |
| 44 | 2026-10-09 | piloto reservas_app: `init` y luego `check` | `init` dice "Test command: npm test" y, acto seguido, `check` avisa "No test command configured" | `init` escribe el comando en `spec.md` y `AI_RULES.md`, pero no crea `harness.config.yaml` con `test_cmd`; solo `harness init` lo hace | 0.17.1: `check` nombra el comando detectado y `harness init`; el primer gate sigue siendo solo la spec, como se documenta |
| 45 | 2026-10-09 | piloto reservas_app: responder una pregunta del borrador | Con Q1 respondida, D7 seguía exigiendo que REQ-146 fuese `Needs Clarification` | D7 lee toda fila de la tabla como abierta; la spec dice "una línea `Answer:` bajo la fila", que no se puede escribir dentro de una tabla Markdown | 0.17.1: columna `Answer` o línea `Answer (Q1): …` bajo la tabla |
| 46 | 2026-10-09 | piloto reservas_app: `change archive` de un borrador en verde | Archivó 18 requisitos y "0 materialised": los 34 escenarios no llegaron a `features/`, y `status` pedía "its scenario" a todos | `archive` solo genera el `.feature` si la traza trae `feature=<ruta>`; ni `draft --check` ni la spec del borrador lo piden ni lo avisan | 0.17.1 |
| 47 | 2026-10-09 | piloto reservas_app: `validate --strict` tras archivar | 35 `scenario_has_no_steps`: los `.feature` generados desde escenarios en español no eran Gherkin válido | `renderDeltaFeature` solo reconoce GIVEN/WHEN/THEN: deja `DADO …` tal cual, escribe `Feature:`/`Scenario:` y no pone `# language: es`, aunque el parser de deltas y `GherkinDialects` sí entienden español | 0.17.1 |
| 48 | 2026-10-09 | piloto reservas_app: `status` | Los 18 requisitos archivados salen sin título en la lista "To do" | `status` no lee el título de `### Requirement: REQ-NNN — …` en `docs/specs/capabilities/*/spec.md` | 0.17.1 |
| 49 | 2026-10-09 | piloto reservas_app: harness REQ-101 y REQ-113 | Un borrador con `draft --check` y `validate --strict` en verde fallaba en el harness: `scenario_title_generic` en "Identificador repetido" y "Franja cerrada" | la calidad de escenarios solo se aplica cuando la fila deja de ser Draft, y `draft --check` no la ejecuta; además "menos de tres palabras" es genérico, y en español un título de dos palabras suele nombrar el comportamiento | 0.17.1: dos palabras bastan, y `draft --check` aplica D9 |
| 50 | 2026-10-09 | piloto reservas_app: harness REQ-101 y REQ-113 | El harness gastó 3 intentos (≈ 5 min y tres llamadas al agente) en cada requisito sobre un fallo que el agente no puede arreglar | el gate falló en un `.feature`, que el agente tiene prohibido editar; el harness reintenta igual en vez de parar con "el fallo está en la spec". Mismo patrón en REQ-147: el agente salió con "You've hit your session limit · resets 11:20am" y el harness lo reintentó 3 veces en 22 s | 0.17.1: para tras un intento por cuota o por fallo solo en la spec |
| 51 | 2026-10-09 | reservas_app ciclo 2 (0.17.1): `draft --check` | D3 exigía un escenario de API a REQ-200 (el menú del panel), que solo existe en pantalla | D3 decide las superficies por actor (`Propietario: [api, web]`), y un requisito no puede decir que vive en una sola | 0.17.2 |
| 52 | 2026-10-09 | reservas_app ciclo 2: `draft --check` | D6 marcaba "Configuración", "Mi comercio" y "11" en el segundo borrador, valores ya revisados en el primero | D6 solo mira el brief y los supuestos del borrador, no la spec archivada del proyecto | 0.17.2 |
| 53 | 2026-10-09 | reservas_app ciclo 2: `change archive` de un MODIFIED | REQ-145 ganó dos escenarios en la spec, y `features/reservas/REQ-145.feature` se quedó con los dos antiguos, sin aviso | `archive` solo materializa un `.feature` que no existe; un requisito modificado deja el suyo obsoleto | 0.17.2 |
| 54 | 2026-10-09 | reservas_app ciclo 2: `status` y `harness run` | Con SCN-200 y SCN-201 sin probar, `status` decía "REQ-145 Ready to close — its test is in place" y el harness lo planificaba como `NEEDS_STATUS_UPDATE`, mientras `validate --strict` decía "Nothing proves" esos dos escenarios | la categoría del plan mira la fila de la matriz (hay test), no la cobertura por escenario que exige `validate` (#32) | 0.17.2 |
| 55 | 2026-10-09 | reservas_app ciclo 4 (feedback, 0.17.2) | El borrador de feedback numeró sus escenarios desde SCN-212, ya de cupones; `draft --check` en verde y `validate` lo vio después de archivar: "Duplicate Scenario ID" | `change new` reserva ids de requisito pero no de escenario, y el checklist no comparaba ids con el proyecto | 0.17.3 |
| 56 | 2026-10-09 | reservas_app ciclo 4: harness REQ-212 | Primer intento rechazado por write-scope: "docs/specs/capabilities/feedback/spec.md (docs/specs/**)". El cambio era solo `status=Implemented` en la traza | el prompt del harness dice "Close each requirement with `specgate done`"; `done` escribe el estado en la spec, que write-scope protege. La instrucción y la barrera se contradecían | 0.17.3 |
| 57 | 2026-10-09 | reservas_app ciclo 5 (escaparate) | Se archivó un borrador con 2 hallazgos de `draft --check` pendientes, sin aviso | `change archive` no consulta el checklist (fase 4 de ADR-0029, sin hacer) | abierto (fase 4) |
| 58 | 2026-10-09 | reservas_app ciclo 5 | Repetir `draft --check` sobre un borrador ya archivado sale en verde aunque antes tuviera hallazgos D6 | desde #52, D6 acepta valores de la spec del proyecto, y al archivar el borrador sus valores pasan a estarlo | abierto (menor: el checklist se pasa antes de archivar) |
| 59 | 2026-10-09 | credito-tienda: `validate --strict` tras archivar | "[TDD-1] Test artifact is TBD but status is 'Needs Clarification'" en REQ-008 y REQ-016: el gate en rojo por dos requisitos bloqueados por una pregunta abierta | `--strict-tdd` exigía test a todo estado posterior a Draft salvo Deprecated; `Needs Clarification` es justo el que la spec de `draft` manda poner a lo que una pregunta bloquea | 0.17.3 |
| 60 | 2026-10-09 | tres pilotos sobre esqueletos recién generados | Cada vez hubo que borrar a mano tres requisitos propuestos por carpetas (core, web, shared); `init --no-capabilities` decía "Unknown argument" | `init` adopta delegando en `adopt` pero no le pasaba `--no-capabilities`, que la guía ofrece | rama `fix/init-no-capabilities` |
| 61 | 2026-10-09 | reservas_app ciclo 5: prueba de humo del escaparate | El propietario no tenía pantalla para la dirección, el teléfono y el horario (REQ-220): solo API | D3 aceptó como escenario de pantalla del propietario uno escrito desde el cliente ("un cliente abre la página") | rama `fix/init-no-capabilities` |
| 36 | 2026-10-08 | CI de Specgate | El job de lint se colgó 6 h | `apt-get update` colgado en ShellCheck, sin timeout | `ci.yml` (#242) |

## No son defectos de Specgate

| # | Qué | Por qué no |
|---|---|---|
| 20 | Packs sin `depends_on` | error de autoría de mis packs (v0.1.2) |
| 25 | El harness commitea `.specops/harness-prompts/` | diseño: es el registro de auditoría |
| 31 | 48/48 "done" sin API ni pantallas | la spec no las pedía; resuelto con packs v0.2.0. **Lección:** "done" significa que se cumple la spec, no que el producto funcione. La idea `specgate draft` con checklist nace de aquí |
