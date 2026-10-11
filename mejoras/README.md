# Índice de `mejoras/` — qué hay abierto y dónde mirar

**Actualizado:** 2026-08-26

> **Empieza por aquí.** Este fichero es el mapa: qué es cada documento y **todo
> lo que está abierto en una sola lista**. Los demás ficheros son el detalle.
> Nada se decide aquí; se localiza.

---

## 1. Qué es cada fichero

| Fichero                                   | Qué es                                                                                                                                             | Estado                                         | Cuándo abrirlo                                                                        |
| ----------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------- | ------------------------------------------------------------------------------------- |
| **`estado-plataforma.md`**                | **Foto de la plataforma a 2026-10-11:** versión, pilotos, packs, web, flujo sin CI y defectos abiertos #83–#92                                     | **Foto fechada**                               | Al retomar después de una pausa larga                                                 |
| **`plan-cierre-enterprise.md`** (1294 l.) | **El backlog vivo.** Fases C0–C9, defectos del harness (§12.11), huecos de producto (§12.12), camino a 1.0 (§12.10) y registro de decisiones (§14) | **Vivo — la autoridad**                        | Antes de empezar cualquier trabajo. Se marca en la misma sesión en que se cierra algo |
| `propuesta-harness-planificacion.md`      | 13 propuestas (A1–E1) para planificación y bucle desatendido                                                                                       | **Propuesta, nada implementado**               | Al decidir qué construir en el harness                                                |
| `valoracion-bdd-gherkin-era-agentes.md`   | Valoración de BDD para agentes + 6 propuestas (F1–F6). Contiene el defecto de los packs                                                            | **Propuesta + 1 defecto verificado**           | Antes de tocar Gherkin, `pack lint` o los packs                                       |
| `analisis-infoq-sdd-enterprise.md`        | Lectura del artículo de InfoQ: qué pide y ya tenemos, qué falta, qué se rechaza                                                                    | Referencia estable                             | Para posicionamiento y para justificar prioridades                                    |
| `openspec-benchmark-plan.md`              | Qué es OpenSpec, comparativa, valoración de SpecOps, qué **no** copiar                                                                             | Referencia estable (recortado de 768 a 413 l.) | Al comparar con la competencia o al diseñar SpecOps                                   |
| `csda-studio-brief.md`                    | El brief del dogfood: REQ-001..015 de la app companion                                                                                             | Congelado para v0.1.0                          | Solo dentro del experimento del studio                                                |
| `csda-studio-handoff.md`                  | **Estado vivo del dogfood.** Fases 0–10, 7 hechas, la 8 es la siguiente                                                                            | **Vivo**                                       | Al retomar el dogfood                                                                 |
| `csda-studio-runbook.md` (1025 l.)        | El procedimiento largo del dogfood                                                                                                                 | Referencia operativa                           | Solo si ejecutas el dogfood                                                           |
| `hie-pilot-runbook.md`                    | El piloto brownfield (Spring Boot + HAPI FHIR), adoptado a L1–L2                                                                                   | **Vivo**                                       | Al retomar el piloto                                                                  |
| **`escalado-multiagente-conectores.md`**  | **Harness multiagente, conectores ALM y csda como plugin de hosts.** Fases E0/E1/E2, cerradas salvo `E2-06`                                        | **Vivo — cerrado salvo E2-06**                 | Al tocar harness, ALM o integración con hosts de agente                               |
| `p1-multirepo-revision.md`                | La revisión de P1 (`E2-05`): qué parte ya funciona y por qué el puerto ALM no lo desbloquea                                                        | Referencia estable                             | Antes de plantear multi-repo                                                          |
| `arquitectura-opcional-perfiles.md`       | DDD/hexagonal/CQRS como perfiles opcionales. Implementado salvo el cambio de defecto                                                               | **Vivo — falta solo el defecto**               | Al discutir qué impone el andamiaje                                                   |
| `colisiones-traceability-paralelo.md`     | Choques en `traceability.md` con el harness en paralelo. Resuelto con un driver de merge por filas                                                 | Cerrado                                        | Si vuelven a aparecer conflictos en la matriz                                         |
| `sustituir-traceability-md.md`            | Alternativas a la matriz y qué hay en el mercado. Conclusión: no tocarla todavía                                                                   | Referencia estable                             | Cuando un proyecto pase de ~150 requisitos                                            |
| `csda-studio-app-como-se-creo.md`         | Cómo se construyó la app del dogfood                                                                                                               | Referencia histórica                           | Contexto del dogfood                                                                  |

**Ocho documentos más fueron eliminados el 2026-08-16** (§12.9 del plan de
cierre) porque describían un pasado terminado con forma de plan. Si una
referencia antigua los cita, están en el historial de git, no en el árbol.

---

## 2. Aviso: hay tres esquemas de IDs y dos colisionan

Esto es probablemente parte de por qué se pierde el hilo:

| Prefijo         | Qué numera                                                             | Dónde                                   |
| --------------- | ---------------------------------------------------------------------- | --------------------------------------- |
| `C0-01`…`C9-08` | Tareas de las fases de cierre                                          | `plan-cierre-enterprise.md`             |
| `G1`…`G5`       | **Gates de 1.0**                                                       | `plan-cierre-enterprise.md` §12.10      |
| `G1`…`G9`       | **Brechas frente a OpenSpec** — _distinto significado, mismo prefijo_  | `openspec-benchmark-plan.md` §3         |
| `H1`…`H13`      | Defectos del harness encontrados ejecutándolo                          | `plan-cierre-enterprise.md` §12.11      |
| `P1`, `P2`      | Huecos de producto                                                     | `plan-cierre-enterprise.md` §12.12      |
| `D1`…`D13`      | Decisiones tomadas                                                     | `plan-cierre-enterprise.md` §14         |
| `A1`…`E1`       | Propuestas de harness (nuevas)                                         | `propuesta-harness-planificacion.md`    |
| `F1`…`F6`       | Propuestas de Gherkin (nuevas)                                         | `valoracion-bdd-gherkin-era-agentes.md` |
| `E0-*`…`E2-*`   | **Escalado: harness multiagente, ALM, hosts** — cerradas salvo `E2-06` | `escalado-multiagente-conectores.md`    |

En este índice, **`GATE-G3`** siempre significa el gate de 1.0 y **`BRECHA-G3`**
la brecha de OpenSpec. Las brechas `BRECHA-G1`..`G4` están cerradas (fases 1–3);
el resto son de referencia histórica.

---

## 3. Todo lo abierto, en una lista

> **Desde 0.7.0, lo abierto vive también como issues en GitHub.** Este índice
> sigue siendo el detalle —el porqué, lo medido, dónde mirar—; los issues son la
> lista accionable. Si divergen, **manda el issue**: es lo que otra persona ve.
>
> |                                                               | Issue                                                                                                                                                                                                                                                     |
> | ------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
> | `GATE-G3` adopción externa · `GATE-G5` ventana de soporte     | [#100](https://github.com/rsaglobaltech/specgate/issues/100) · [#101](https://github.com/rsaglobaltech/specgate/issues/101)                                                                                                                               |
> | `P2` superficie de lectura · `P1` multi-repo                  | [#102](https://github.com/rsaglobaltech/specgate/issues/102) · [#103](https://github.com/rsaglobaltech/specgate/issues/103)                                                                                                                               |
> | `E2-06` `projects:` en `plan`/`status`/`report`               | [#104](https://github.com/rsaglobaltech/specgate/issues/104)                                                                                                                                                                                              |
> | `B3` · `D2` · `D3` · `F6`                                     | [#105](https://github.com/rsaglobaltech/specgate/issues/105) · [#106](https://github.com/rsaglobaltech/specgate/issues/106) · [#107](https://github.com/rsaglobaltech/specgate/issues/107) · [#108](https://github.com/rsaglobaltech/specgate/issues/108) |
> | `C8-01` · `C8-02` · `C8-03` · `C8-04`                         | [#109](https://github.com/rsaglobaltech/specgate/issues/109) · [#110](https://github.com/rsaglobaltech/specgate/issues/110) · [#111](https://github.com/rsaglobaltech/specgate/issues/111) · [#112](https://github.com/rsaglobaltech/specgate/issues/112) |
> | ~~Decisiones: `C9-05` · `ARCHITECTURE` layered · `linkBack`~~ | Las tres **decididas que no** el 2026-09-01 — [#113](https://github.com/rsaglobaltech/specgate/issues/113) · [#114](https://github.com/rsaglobaltech/specgate/issues/114) · [#115](https://github.com/rsaglobaltech/specgate/issues/115) cerradas         |
> | Dos grafías de `payload` en los packs _(salió de `E1`)_       | [#116](https://github.com/rsaglobaltech/specgate/issues/116)                                                                                                                                                                                              |

### 3.1 Bloquea el 1.0 — dos cosas, y ninguna es código

| ID                    | Qué falta                                                                                                                                                                    | Coste                  | Nota                                               |
| --------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------- | -------------------------------------------------- |
| **GATE-G3** (= C9-08) | **Que un equipo de fuera adopte L1–L2 y reporte.** Nadie ajeno al repo lo ha usado                                                                                           | Trabajo de campo       | Es _el_ bloqueante real. No hay test que lo cierre |
| **GATE-G5**           | Borrar de `docs/release-process.md:38` la frase «_That is intent, not a promise, until it is written here without this sentence_» y aceptar mantener un minor más seis meses | 1 línea + una decisión | Verificado: la frase sigue ahí                     |

> **Antes que nada:** la ronda 1 de `GATE-G6` devolvió dos «no adoptar» y un
> «adoptar con reservas». [`plan-feedback-adopcion.md`](plan-feedback-adopcion.md)
> ataca ese feedback y **precede a cualquier función nueva**. Se da por bueno
> cuando tres agentes nuevos, en las mismas condiciones, dicen otra cosa.

| **GATE-G6** | **Adopción simulada**: tres repos brownfield de dominios distintos llevados a L1–L2 por agentes aislados, cada uno con su assessment medido | Trabajo de campo simulado | **Ronda 1 hecha el 2026-09-01** — [assessment](sim-round-1-assessment.md), 3 defectos (H22–H24) cerrados. [ADR-0025](../docs/specs/adr/0025-simulated-adoption-is-not-external-adoption.md). **No cierra G3** y no mueve la 1.0 |

`GATE-G1` (dos releases sin breaking), `GATE-G2` (bucle completo de punta a
punta) y `GATE-G4` (gate de cobertura) están **cerrados**.

`GATE-G6` existe para que la evidencia simulada tenga dónde aterrizar sin
disfrazarse de G3. Lo que compra G3 —independencia de las suposiciones del autor,
y la señal de que alguien con algo en juego _sigue_ usando la herramienta— un
agente no puede darlo: no se cansa, no tiene política de equipo y nunca abandona
por frustración, que es lo más ruidoso que dice un adoptante real.

**Actualización 2026-08-25 (D14, plan de cierre §12.10).** `GATE-G3` y
`GATE-G5` siguen exactamente así — abiertos, sin código pendiente— pero dejan
de ser lo próximo que se ataca. Se antepone cerrar el hueco de verificación
descrito en `PLAN_PREDICTABLE_CODE_EVOLUTION.md` §4: `csda validate` comprueba
que el papeleo es coherente, no que el código haga lo que la spec dice. Ver
§5 más abajo.

> **Matiz que importa ahora:** G1 se cumplió con dos releases **de arreglos**.
> La prueba real llega con la siguiente release que **añada** algo — es decir,
> con lo primero que se implemente de las propuestas de §3.4.

### 3.2 Defectos abiertos — el bucle aprueba cosas sin comprobarlas

| ID                                 | Defecto                                                                                                                                                                                                                                                                                         | Dónde                   | Propuesta que lo cierra |
| ---------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------- | ----------------------- |
| ~~**H15**~~ **cerrado 2026-08-22** | **Un filtro de escenario que no casa nada salía 0.** Reproducido: `cucumber-js --tags '@does-not-exist'` daba `1 passed`, rama publicada y requisito cerrado. Cerrado por `F5` leyendo el protocolo de mensajes                                                                                 | `valoracion-bdd…` §2.2  | ~~F5~~ **hecho**        |
| ~~**H16**~~ **cerrado 2026-08-22** | **El gate no comprobaba que el agente no tocó `spec.md`, `AI_RULES.md` ni `features/**`.** El prompt lo pedía; nadie lo verificaba. Reproducido: un agente que sustituyó el escenario por `Given nothing / Then nothing is asserted` obtuvo `1 passed · 0 failed`. Cerrado por `A1`             | `propuesta-harness…` A1 | ~~A1~~ **hecho**        |
| ~~**H13**~~ **cerrado 2026-08-23** | **El JSON Schema declaraba autoridad que no ejercía.** Medido: 10 de 11 packs lo fallaban mientras los 11 pasaban `pack lint --strict`. Y no era papeleo — instalar cualquier pack producía documentos con `Context`, `Invariants`, `Producer` y `Consumers` vacíos. Cerrado por `E1`, opción B | §12.11                  | ~~E1~~ **hecho**        |

`H1`–`H8`, `H10`, `H11` están cerrados y publicados en 0.5.0 / 0.6.0.
`H9`, `H12` y `H14` también, en la rama actual: `E1-03`, `E1-01` y `F2`.

**H15 y H16 son la misma familia que H1**: el gate aprueba sin verificar. Es la
razón por la que la tanda 1 de §3.5 va primero. **H14 se cerró el 2026-08-22**
con `F2` — ver §6.

### 3.3 Huecos de producto

| ID     | Hueco                                        | Estado                       | Lo que falta, concretamente                                                                                                                                              |
| ------ | -------------------------------------------- | ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **P2** | Superficie de lectura para quien no abre PRs | **Abierto y barato**         | `.github/workflows/pages.yml` publica `docs/` y el registry, pero **no** ejecuta `csda report` ni exporta `studio`. Son ~6 líneas de workflow más un enlace en el README |
| **P1** | Orquestación multi-repo                      | **Abierto, v2 por decisión** | No es una función: identificador supra-repo, correlación de estados y matriz federada. Mientras, `alm sync` es el puente                                                 |

### 3.3b Escalado (serie `E`) — cerrada salvo una

Cerradas entre el 2026-08-20 y el 2026-08-21, cada una con lo que encontró
anotado en `escalado-multiagente-conectores.md`: registro único de superficie,
puerto ALM con kit de conformidad, ADR-0021, grafo de dependencias, paralelismo,
registro de ejecuciones, plugin de Claude Code, proveedor GitHub, Antigravity,
roles como perfiles, `change author`, `alm pull` y proveedores de comunidad.

| ID          | Qué falta                                                                                                                                                            | Coste |
| ----------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----- |
| **`E2-06`** | `plan`, `status` y `report` honran `projects:` como ya hace `validate`. Salió de la revisión de `E2-05`: hoy `validate` recorre N repos y los demás ven solo el raíz | Bajo  |

**Fuera de serie, y pendientes de decisión tuya:**

| Qué                                                | Por qué está parado                                                                                                                                                                                                                 |
| -------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Cambiar el defecto de `ARCHITECTURE` a `layered`   | Es rotura: proyectos nuevos dejarían de recibir seis documentos. Va con un major                                                                                                                                                    |
| ~~`linkBack(issueKey, specUrl)` en el puerto ALM~~ | **Descartado el 2026-09-01** ([#115](https://github.com/rsaglobaltech/specgate/issues/115)): una spec vive en una ruta de un repositorio, no en una URL, e inventar una por proveedor es una suposición que el puerto no debe hacer |

### 3.4 Propuestas nuevas — nada de esto está implementado

**De `propuesta-harness-planificacion.md`:**

| ID     | Propuesta                                                                                                                                                                                                                                                                                                                                                                                                                 | Coste      |
| ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| ~~A1~~ | **Hecho (2026-08-22), cierra `H16`.** `core/domain/WriteScope` + comprobación en el worktree **antes** de la puerta. Medido: sin ella, un agente que vació el escenario obtuvo `1 passed`, rama publicada y requisito cerrado. Crear un feature nuevo se permite (`NEEDS_FEATURE`); modificar uno existente, no — git ya separa ambos casos                                                                               | Bajo       |
| ~~A2~~ | **Hecho (2026-08-22).** `core/domain/DeclaredArtifacts`, tras puerta verde, reutilizando el diff de `A1`. Aviso por defecto, error con `--strict-artifacts`. Solo compara declaraciones que **nombran un fichero**: la fila del andamio dice `` `API /health`, smoke test `` y `TBD`, y avisar de eso sería ruido                                                                                                         | Bajo       |
| ~~A3~~ | **Hecho (2026-08-22).** Las ocho reglas viven en `core/domain/GherkinQuality` y emiten `Diagnostic` (ADR-0017). `pack lint` las consume con salida idéntica byte a byte; `validate --strict-scenarios` las aplica sobre `features/**`; `doctor` las reporta como aviso (adopción gradual); `harness run` las exige **antes** de crear el worktree. Destapó una tercera copia de la normalización de ruta a punto de nacer | Medio-bajo |
| ~~B1~~ | **Hecho (2026-08-23).** Orden topológico, apilado y aviso de base obsoleta ya existían; faltaba que un **pack** pudiera declarar `depends_on`. Ahora viaja pack → `expand` → matriz → `plan` → harness, y `REQ-002` se corta de la rama de `REQ-001`. Ciclos y referencias rotas se rechazan al validar el pack, no en ejecución                                                                                          | Medio-alto |
| ~~B2~~ | **Hecho (2026-08-22).** `core/domain/RequirementReadiness`: `ready` + `blockers[]` con `fix` en `plan --json`, y `harness run --skip-not-ready`. Por defecto avisa y ejecuta (es una minor); el escenario no ejecutable salta siempre, que es la guarda de `A3`. Se añadió `Needs Clarification` como bloqueante: un agente al que se le pide zanjar una discusión la zanja adivinando                                    | Bajo-medio |
| B3     | `--by-scenario` — requisito grande por partes                                                                                                                                                                                                                                                                                                                                                                             | Medio      |
| ~~C1~~ | **Hecho (2026-08-22).** El paralelismo con niveles ya existía; faltaba el techo: `--budget-seconds`, `--max-requirements` y `cost_per_run_hint` por perfil. Se pregunta **antes de empezar** cada requisito, nunca a mitad. Agotarlo no es error: parada limpia, lo no empezado se nombra, y el libro se escribe igual                                                                                                    | Medio      |
| ~~C2~~ | **Hecho (2026-08-22).** Reescoped: `E1-04` ya había puesto el libro y las dos métricas de coste. Se añadió lo que faltaba — dónde falla la puerta (por intento, no por veredicto), requisitos que agotan el presupuesto, serie temporal, y `--mark-false-failure` con `--reason` obligatorio. La tasa de fallo real queda en `—` hasta que alguien marca: no es derivable                                                 | Medio-bajo |
| ~~C3~~ | **Hecho (2026-08-22).** `--resume` reengancha rama y worktree superviviente. La fuente **no** es el libro de ejecuciones —solo se escribe al terminar, y esto es para las que no terminan (medido con `kill -9`)— sino el archivo de prompts. Distingue cortado de agotado por el commit `wip(…): FAILED the gate`                                                                                                        | Bajo       |
| ~~D1~~ | **Hecho (2026-08-23).** Un perfil con `match:` se elige solo; primera coincidencia gana. El criterio de la propuesta —el bounded context— **no era alcanzable** desde un requisito: 0 de 27 escenarios enlazan con un agregado. `expand` lo deriva ahora por caso de uso → comando → agregado y lo escribe junto a la matriz                                                                                              | Bajo-medio |
| D2     | Precedentes del repositorio en el prompt                                                                                                                                                                                                                                                                                                                                                                                  | Bajo       |
| D3     | Verificación adversarial opcional                                                                                                                                                                                                                                                                                                                                                                                         | Medio      |
| ~~E1~~ | **Decidido y hecho (2026-08-23).** Opción B: el esquema describe el formato que existe, y los 11 packs enviados se validan contra él en la suite. Enmienda a ADR-0020. Destapó dos defectos más, arreglados aparte                                                                                                                                                                                                        | Decisión   |

**De `valoracion-bdd-gherkin-era-agentes.md`:**

| ID     | Propuesta                                                                                                                                                                                                                                                                                                                                                                                                             | Coste |
| ------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----- |
| ~~F3~~ | **Hecho (2026-08-22).** `scenario_has_no_steps` y `keyword_case_invalid` son errores por sí solos, sin `--strict`, con fichero:línea y la grafía que funciona. Al ejecutarlo se destapó que `pack init` **seguía generando `GIVEN/WHEN/THEN`**: `F2` arregló los packs escritos, no el generador que los escribe. Corregido y con guarda sobre los cuatro tipos de proyecto. La parte de `validate` era `A3`          | Bajo  |
| ~~F4~~ | **Hecho (2026-08-23).** `expand` y el andamio etiquetan `@REQ-NNN @SCN-NNN`; `validate` comprueba por fin que el escenario que la matriz declara **existe** en su fichero. Un fichero sin etiquetas se deja en paz: la adopción no se convierte en muro. El filtrado del gate por etiqueta ya funcionaba — solo faltaban las etiquetas                                                                                | Medio |
| ~~F5~~ | **Hecho (2026-08-22), cierra `H15`.** `core/domain/CucumberMessages` lee el NDJSON de `--format message`: existe el escenario, **se ejecutó**, tenía pasos, todos `PASSED`, y cuántos corrieron. Construido contra un flujo real, no de memoria — de ahí que los pasos de _hook_ no cuenten como pasos. Opcional: sin Cucumber, la puerta sigue siendo el código de salida                                            | Medio |
| ~~F6~~ | **Hecho (2026-08-25).** `csda validate --strict-requirements` sobre `docs/specs/capabilities/**/spec.md`: falta de obligación RFC 2119 (ahora también fuera de los deltas — única fuente movida a `RequirementSyntax.ts`, `DeltaSpec` la importa) y la única forma EARS que un regex puede comprobar honestamente, `IF` sin `THEN`. Opt-in, mismo motivo que `A3`. Detalle en `valoracion-bdd-gherkin-era-agentes.md` | Bajo  |

### 3.5 Trabajo de campo vivo

| ID            | Qué                                                | Dónde está               | Siguiente acción concreta                                                                                    |
| ------------- | -------------------------------------------------- | ------------------------ | ------------------------------------------------------------------------------------------------------------ |
| **C8-01**     | Dogfood CsdaStudioApp — fases 8, 9 y 10 de 10      | `csda-studio-handoff.md` | `csda harness run --req REQ-001` … `REQ-014` sobre `csda-studio-app`, revisar las ramas, taguear y desplegar |
| **C8-02**     | Piloto HIE (brownfield, Spring Boot + HAPI FHIR)   | `hie-pilot-runbook.md`   | Adoptado a L1–L2 y `validate` pasa. Falta **conducir la implementación** con el harness                      |
| **C8-03**     | Case studies 2 y 3                                 | §11 del plan             | Solo existe `docs/case-studies/case-1.md`                                                                    |
| **C8-04**     | Vídeo demo de 90 s + vídeo del bucle bidireccional | §11 del plan             | Pendiente desde la fase 1. Es lo que cierra RISK-004                                                         |
| ~~**C9-05**~~ | Telemetría opt-in                                  | §12.2 del plan           | **Decidido el 2026-09-01: no se hace** ([#113](https://github.com/rsaglobaltech/specgate/issues/113))        |

> **C8-01 y C8-02 son los que más rinden**, y no por su valor propio: son las
> dos únicas fuentes que han producido defectos reales del harness. Los diez de
> §12.11 salieron de ahí. H14 salió de leer los packs que alimentan a ambos.

### 3.6 Aplazado por decisión — no lo busques, no está pendiente

`C7-05` Maven Central · `C7-06` Gradle Plugin Portal · `C7-07` VS Code
Marketplace · `C7-08` scope npm `@spec-driven` · `C7-09` desplegar el registry.

Todos `[-]` **por decisión D9 y D12**: son otro producto, con otras credenciales
y otro ciclo. Van a **v2**. Cada uno está bloqueado por una credencial, no por
código (§12.8 del plan tiene el detalle de cuál).

---

## 4. Duplicados ya resueltos

Para que no se cuenten dos veces:

| Es lo mismo que |                                                                   |
| --------------- | ----------------------------------------------------------------- |
| `E1`            | `H13`                                                             |
| `B1`            | `H12` (y resuelve `H9` de paso)                                   |
| `A1`            | `H16`                                                             |
| `F2`            | `H14`                                                             |
| `F5`            | `H15` (y sustituye la heurística de `H10` por un dato)            |
| `GATE-G3`       | `C9-08`                                                           |
| `P2`            | Recomendación nº 3 del análisis InfoQ                             |
| `D1`            | §2.3 del análisis InfoQ («agentes especializados por dominio»)    |
| `C2`            | §5 del análisis InfoQ («efectividad del mecanismo de validación») |

---

## 5. El orden que recomiendo

**Tanda 1 — que el gate deje de aprobar sin comprobar. CERRADA (2026-08-22).**
~~`F2`~~ → ~~`F1`~~ → ~~`F3`~~ → ~~`A3`~~ → ~~`A1`~~ → ~~`A2`~~.
El orden importaba: extraer las reglas de calidad (`A3`) sobre el parser
anterior habría propagado el defecto de `H14` a `validate`. Primero que el
parser dijera la verdad, después extender su alcance.

**Tanda 2 — CERRADA (2026-08-22).** ~~`C3`~~ → ~~`C2`~~ → ~~`B2`~~ → ~~`F5`~~ → ~~`C1`~~.

**Tanda 3 — CERRADA (2026-08-23).** ~~`E1`~~ → ~~`B1`~~ → ~~`D1`~~ → ~~`F4`~~.

**Las tres tandas del índice están cerradas.**

**Tanda 2 — que el bucle rinda desatendido.** `C3` → `C2` → `B2` → `F5` → `C1`.
Barato antes de caro, y `C2` es lo que permite medir si el resto sirve.

**Tanda 3 — cambio de modelo.** `E1` (decisión) → `B1` → `C1` con paralelismo →
`D1` → `F4`. Toca el formato de pack; post-1.0.

**En paralelo, y sin depender de nada:** `P2` (una tarde), `GATE-G5` (una línea),
`C8-01` y `C8-02` (que es de donde salen los defectos de verdad).

**Tanda 4 — verificación, antepuesta el 2026-08-25 (D14).** ~~`F6`~~ **hecho
(2026-08-25)** — sin un valor declarado y comprobable en la spec no había nada
que una puerta nueva pudiera leer; ahora `--strict-requirements` lo comprueba
en reposo. ~~§8.5, mitad 1~~ **hecho (2026-08-25)** — `csda validate
--strict-links` comprueba que Feature file / Technical artifact / Test
artifact sigan existiendo en disco. Corrección medida en el camino: la primera
versión era incondicional y rompió `tests/unit/validate-strict-tdd.test.ts`
(una fila `Draft`/`In Dev` declara con normalidad un fichero que aún no
existe) — opt-in, misma promesa que `--strict-scenarios`. ~~§8.6~~ **hecho
(2026-08-26).** `packages/core/src/domain/ValueAnnotations.ts` (dominio, puro,
12 tests) + `buildDeclaredValues` en `ReportCommand.ts` (I/O, 12 tests).
`value_<id>=<literal>` en el `csda:trace` de la spec, `// csda:value
<id>=<literal>` en el código (cadena literal, no comentario reconocido por
lenguaje), igualdad exacta, ficheros tomados de los mismos Technical/Test
artifact que `--strict-links` ya valida. **Corrección de alcance en la misma
sesión, antes de escribir código:** la primera versión era un gate
`--strict-values` calcado de los otros tres flags; objeción correcta —
valor-por-valor con gate duro no escala: el coste de anotar crece con el
número de hechos comprobables mientras la cobertura no, y cuanto más complejo
el proyecto menor la fracción de requisitos que son un valor escalar y no una
regla con ramas. Se cambió la entrega, no la anotación: **sin flag nuevo en
`validate`** — una sección nueva de `csda report` (matched / diverging /
spec_only / code_only, sin fallar nada), `--record` con tres campos aditivos
en el historial, `sparkline()` con una segunda serie punteada cuando todo el
historial la tiene. `tests/unit/architecture.test.ts` no se tocó, sus cuatro
reglas siguen en verde. Medido contra este propio repo: cero anotaciones hoy
→ `declaredValues` todo cero, sección oculta — el mismo trato que
`orphanFeatures`. **Pendiente, y a propósito no fabricado para la demo:**
anotar un requisito real de este repo o de `csda-studio-app` — los REQ-1xx de
`change-lifecycle` siguen en `Draft` sin artefacto técnico declarado, así que
inventar un enlace solo para ver `matched` en verde habría sido la misma
deriva documental que esto existe para detectar.

Ver el detalle y lo que se descarta expresamente (Z3, tree-sitter, proofs
criptográficas) en `PLAN_PREDICTABLE_CODE_EVOLUTION.md` §5 y §8.4.

**Además, el 2026-08-26: tres rutas ante una divergencia (§11 del plan) —
ruta 2 hecha.** §8.6 detecta `diverging`; no ofrecía nada que hacer con eso.
Medido antes de construir: rutas 1 (arreglar código) y 3 (retirar el
requisito) no necesitaban herramienta nueva — `report` ya da `file:line`, y
`change new --capability` + `REMOVED Requirements` a mano ya cubre el
retiro. Ruta 2 sí era pegamento real: `csda change new <id>
--from-value-drift REQ-ID:value_id` genera un delta `MODIFIED Requirements`
con el `value_<id>` reescrito al valor del código y un `TODO:` para la
prosa — nunca reescribe la frase sola, esa es la misma contención de `pack
infer` con lo que no puede inferir. Reutiliza `readCapabilityRequirements`
(extraído a `scripts/lib/capability-specs.ts`, un solo lector para `report` y
`change`, lección F1/A3) y `renderRequirement` ya existente. 14 tests nuevos,
generado y pasado por `csda change validate` de verdad, no solo por fixtures
de texto.

**Aparcado el 2026-08-26, tras medir: counterexamples concretos.** La nota de
`PLAN_PREDICTABLE_CODE_EVOLUTION.md` §7 lo llamaba "ruta barata" porque
`fast-check` ya está en devDeps. Medido antes de construir:
`tests/unit/property-based.test.ts` lo usa contra funciones de **este propio
repo**, importadas en el mismo proceso — barato solo porque la función ya
vive ahí. Un counterexample real de "tu código viola tu spec" exige
**ejecutar código del usuario**, que rompe el agnóstico-a-lenguaje que
sostiene `csda:trace`/`csda:value` toda la sesión y abre una superficie de
confianza nueva. Va a la fila de Z3/SMT/Lean 4 — horizonte, no la próxima
tarea. Detalle en el plan §7.

**Sin fecha:** `B3`, `D2`, `D3`, `C8-03`, `C8-04`.

---

## 6. Lo que ya está cerrado — para dejar de buscarlo

- **Fases C0 a C7 completas.** 0.6.0 publicada; npm con procedencia SLSA e
  imagen multi-arch verificadas.
- **Los defectos H1–H8, H10 y H11** del harness, publicados en 0.5.0 y 0.6.0.
- **`F1`** — 2026-08-22. Un solo lector de Gherkin en
  `packages/core/src/domain/Gherkin.ts`, puro y sensible a mayúsculas, con la
  tabla de dialectos vendorizada como datos y **cero dependencias de runtime**.
  Dos guardas contra la deriva: tabla contra la oficial, y parser contra
  `@cucumber/gherkin` sobre los 38 ficheros publicados más ocho casos
  construidos. Los tres parsers de §2.4 quedan en uno.
- **`F2` / `H14`** — 2026-08-22. Los 27 ficheros de packs pasan a palabras clave
  canónicas, y `tests/unit/shipped-gherkin.test.ts` parsea con el parser real de
  Cucumber cada Gherkin que se publica y falla si un escenario tiene cero pasos.
  Medido antes y después: `0 steps · exit 0` → `3 steps · exit 1`.
- **Los gates GATE-G1, GATE-G2 y GATE-G4** del camino a 1.0.
- **Las brechas BRECHA-G1..G4** frente a OpenSpec (ciclo de cambio, contrato de
  agente, superficie de agente).
- **RISK-001** (Windows) y **RISK-002** (formato de packs) del `spec.md`.
- **Trece decisiones firmes** en §14 del plan de cierre. Si algo parece abierto
  y está ahí, está decidido, no pendiente.

Comprobado en esta sesión, sobre `main`: `csda validate .` pasa, la suite BDD da
22 escenarios y 126 pasos en verde, y las dependencias de Cucumber están al día
(13.2.1 / gherkin 42).

---

## 7. Cómo mantener esto

Tres reglas, heredadas de `AI_RULES.md` y del §0 del plan de cierre:

1. **`plan-cierre-enterprise.md` sigue siendo la autoridad.** Este índice
   apunta; no decide ni marca nada como hecho.
2. **Nada se marca cerrado sin comprobarlo**, y se marca en la misma sesión en
   que se cierra.
3. **Un ítem nuevo nace en su documento de origen** y luego aparece aquí. Si
   aparece solo aquí, este fichero se convierte en el décimo sitio donde
   perderse — que es exactamente el problema que viene a resolver.

**Pendiente de registrar en el plan de cierre:** `H14`, `H15` y `H16` son
defectos verificados y deberían anotarse en su §12.11 junto a los demás, no
vivir solo en una propuesta.
