# Propuesta — planificación y codificación automática con el harness

**Abierto:** 2026-08-22 · **Alcance:** `main` · **Estado:** propuesta, nada implementado

Análisis de la documentación completa de `main` con una pregunta concreta:
**qué le falta a esta herramienta para que el bucle desatendido rinda más, sin
que el gate deje de ser un gate.** No es un catálogo de ideas: cada ficha dice
qué se rompe hoy, con la evidencia en el código o en los registros de ejecución
real, qué cuesta y por qué no afloja el rigor.

## 0. Cómo se verificó esto

Leídos: `README.md`, `spec.md`, `AI_RULES.md`, `docs/**` (24 ficheros),
`mejoras/**` (6), y el código de `scripts/harness/{run,prompt,config,init}.ts`,
`scripts/plan.ts`, `scripts/validate_specs.ts`, `scripts/lint_pack.ts`,
`scripts/report.ts`.

Cada afirmación de "hoy no existe" está comprobada sobre el árbol, no recordada.
Donde el hueco **ya está registrado** en `plan-cierre-enterprise.md` (H9, H12,
H13, P1, P2) se dice explícitamente y no se reclama como hallazgo nuevo.

## 1. Diagnóstico en una frase

El harness ya sabe **ejecutar** un requisito; lo que le falta es saber **cuál,
en qué orden, con qué presupuesto — y comprobar que el agente no reescribió la
regla que lo juzgaba.**

Tres carencias, en orden de gravedad:

1. **El gate confía en el prompt.** `buildPrompt` le dice al agente que no toque
   `spec.md`, `AI_RULES.md` ni `features/**/*.feature`
   (`scripts/harness/prompt.ts`), y **nada lo comprueba**: el gate es
   `validate --strict-tdd` + `test_cmd` (`scripts/harness/run.ts:266`). El
   agente tiene permiso de escritura sobre el fichero que define su propio
   criterio de éxito. Es el defecto hermano de H1 — aquel era «el gate no
   ejecutaba el escenario que supervisaba»; este es «el gate no comprueba que el
   escenario siga siendo el mismo».
2. **La planificación es una lista, no un plan.** `plan` clasifica por categoría
   y ordena por matriz (`scripts/plan.ts:158-166`). No hay dependencias entre
   requisitos (H12), ni comprobación de que un requisito esté listo para
   entregarse a un agente antes de gastar 1200 s y tokens en él.
3. **La ejecución desatendida no está gobernada.** Secuencial, sin techo de
   coste, sin reanudación y sin memoria: no existe `--max-parallel`, ni
   `--budget`, ni `--resume`, ni un historial de ejecuciones. Comprobado por
   ausencia en `scripts/harness/run.ts`. La tercera ejecución real murió por el
   límite de gasto de la cuenta (§12.11 del plan de cierre) y no había forma de
   continuarla.

## 2. Las propuestas, en orden

| ID     | Propuesta                                                      | Coste      | Qué compra                                                  | ¿Registrado ya?               |
| ------ | -------------------------------------------------------------- | ---------- | ----------------------------------------------------------- | ----------------------------- |
| **A1** | Guardia de alcance de escritura en el gate                     | Bajo       | Que el agente no pueda editar su propio criterio de éxito   | Nuevo                         |
| **A2** | El diff verde debe tocar los artefactos declarados             | Bajo       | Que la matriz no mienta sobre dónde vive el código          | Nuevo                         |
| **A3** | Calidad de escenario en el proyecto, no solo en el pack        | Medio-bajo | Que el gate sea fuerte donde el harness realmente corre     | Nuevo                         |
| **B1** | `depends_on` + orden topológico en `plan` y apilado automático | Medio-alto | Que una ejecución sin `--req` deje de fallar en cascada     | H12, H9                       |
| **B2** | Preparación del requisito antes de gastar tokens               | Bajo-medio | Que el intento desperdiciado se detecte antes de pagarlo    | Nuevo                         |
| **B3** | `--by-scenario`: entregar un requisito grande por partes       | Medio      | Fallos localizables y contexto más corto                    | Nuevo                         |
| **C1** | Presupuesto global y paralelismo con tope                      | Medio      | Que una noche de bucle tenga techo de tiempo y de factura   | Nuevo                         |
| **C2** | Historial de ejecuciones y efectividad del gate                | Medio-bajo | La métrica que el propio análisis InfoQ señaló como nuestra | Parcial (§5 del análisis)     |
| **C3** | `--resume` de una ejecución interrumpida                       | Bajo       | No perder el trabajo de un corte a mitad                    | Nuevo                         |
| **D1** | Perfil de agente por requisito, no por ejecución               | Bajo-medio | Restricciones por dominio aplicadas solas                   | §2.3 análisis InfoQ           |
| **D2** | Precedentes del repositorio en el prompt                       | Bajo       | Un intento menos gastado en adivinar la convención          | Nuevo                         |
| **D3** | Verificación adversarial opcional                              | Medio      | Un segundo par de ojos que solo puede rechazar              | Nuevo, y **después** de A1–A3 |
| **E1** | H13 antes de tocar el formato de pack                          | —          | Que `depends_on` no agrande una mentira existente           | H13                           |

---

## A. Rigor del bucle

Sin esta tanda, todo lo demás amplifica errores más rápido. Va primero por eso,
no por tamaño.

### A1 · Guardia de alcance de escritura en el gate — **hecho (2026-08-22)**

**Hoy.** El prompt lo pide; nadie lo comprueba. Un agente que no consigue pasar
el escenario puede relajar el escenario, o añadir una regla permisiva a
`AI_RULES.md`, y el gate lo aprueba: `validate --strict-tdd` comprueba que el
feature **exista** y esté en la matriz, no que **diga lo mismo que antes**.

Esto no es un supuesto teórico: es exactamente el fallo que el producto promete
impedir. «Specs as executable contracts» deja de ser cierto si el ejecutor puede
editar el contrato.

**Propuesta.** Antes de `csda done`, dentro del worktree:

```
git diff --name-only <base>..HEAD
```

Cualquier ruta protegida tocada → el intento falla con
`agent_touched_protected_path`, y el diff de esa ruta se inyecta en el feedback
del siguiente intento (el agente casi siempre lo hizo sin intención, y verlo lo
corrige). Por defecto protegidas: `spec.md`, `AI_RULES.md`,
`features/**/*.feature`, `docs/specs/**`, `.specops.lock`,
`harness.config.yaml`. Configurable en `harness.config.yaml`:

```yaml
protected_paths:
  - "spec.md"
  - "features/**/*.feature"
allow_paths: # escotilla explícita, no silenciosa
  - "features/legacy/**"
```

**Rigor.** Sube. Es la única propuesta de la lista que cierra un camino por el
que hoy puede colarse trabajo aprobado sin verificar.

**Coste.** Bajo — una función, un código de diagnóstico, tests de ambos signos.
Un requisito legítimo que **debe** crear su feature (categoría
`NEEDS_FEATURE`) necesita la excepción: crear un feature que no existía se
permite; **modificar** uno existente, no. Esa distinción es la parte que hay que
escribir con cuidado.

### Lo que se midió antes de escribirlo

H16 no era teórico y ahora hay número. Un agente que, en vez de implementar,
sustituyó el escenario por lo mínimo que compila:

```gherkin
Feature: Platform health baseline
  Scenario: API reports service as healthy
    Given nothing in particular
    When nothing happens
    Then nothing is asserted
```

Resultado del harness **sin** la guardia:

```
1 passed · 0 failed · 0 skipped
```

Rama publicada, requisito cerrado. Con la guardia: `0 passed · 1 failed`, con
el fichero y el patrón que lo protege nombrados.

> Montar esa medición costó una corrección: el primer proyecto de prueba nunca
> podía ponerse verde, porque el andamio deja un `REQ-001` de plantilla en
> `spec.md` sin fila en la matriz y `--strict-tdd` lo rechaza (TDD-3). Con eso,
> la puerta fallaba siempre y la contraprueba no demostraba nada. El fixture de
> la prueba lo quita, y hay un test previo que verifica que **esa puerta sí
> puede pasar** — sin él, el test de la guardia sería verde por el motivo
> equivocado.

### Lo que se hizo

- `packages/core/src/domain/WriteScope.ts`: los patrones por defecto, el
  emparejador de globs (escrito, no instalado — cero dependencias de runtime) y
  la lectura de `git status --porcelain`. Sin E/S: la decisión se prueba sin
  repositorio ni agente.
- La comprobación corre **antes** de la puerta, no después: una vez relajado el
  escenario, una puerta verde no significa nada, así que no merece la pena
  preguntársela.
- El diff de las rutas tocadas vuelve al prompt del siguiente intento. No es
  cortesía: el agente casi siempre lo hizo sin querer, y ver el hunk es lo que
  lo corrige. Un rechazo sin prueba se repite.
- `write-scope` es una etapa propia en `AttemptRecord`, no un sabor de `gate`,
  para que `harness report` pueda contarla aparte.
- `protected_paths` y `allow_paths` en `harness.config.yaml`, **solo desde el
  fichero**. Igual que la escalera de roles: una bandera que amplía lo que el
  agente puede editar es una bandera que alguien acaba escribiendo para que una
  ejecución roja se ponga verde. Una lista mal formada se rechaza, no se ignora
  — una guardia que protege silenciosamente nada es peor que ninguna guardia.

**La distinción delicada, resuelta por git.** Crear un feature que no existía es
legítimo (`NEEDS_FEATURE`); modificarlo, no. Es exactamente la línea que git ya
traza: sin rastrear = nuevo, cambio rastreado = edición. Y es segura en la
dirección que importa: la fila de la matriz apunta a un fichero concreto, así
que un fichero nuevo no puede aflojar el contrato que la puerta ejecuta; borrar
el declarado y escribir otro aparece como borrado, y se rechaza.

### A2 · El diff verde debe tocar los artefactos declarados — **hecho (2026-08-22)**

**Hoy.** La fila de la matriz declara `test_artifact` y `technical_artifact`, y
el prompt se los pasa al agente (`scripts/harness/prompt.ts`, sección
«Requirement facts»). El gate no comprueba que el diff los contenga. Un agente
puede implementar en otro sitio, pasar el escenario, y la matriz queda
apuntando a un fichero que no es donde vive la lógica — precisamente el tipo de
mentira documental que este repositorio se prohíbe a sí mismo en `AI_RULES.md`.

**Propuesta.** Comparar el diff con los artefactos declarados de la fila.
Ausencia → diagnóstico `declared_artifact_untouched` con el `fix` («o implementa
ahí, o corrige la fila con `csda req link`»). **Advertencia por defecto**,
error con `--strict-artifacts`. Advertencia, porque hay casos legítimos —
implementación que cae en un módulo compartido ya existente — y convertir eso en
fallo duro sin datos sería la clase de gate que rechaza trabajo bueno, que ya
costó dos ejecuciones en REQ-002.

**Coste.** Bajo. Reutiliza el diff de A1.

### Lo que se hizo

`packages/core/src/domain/DeclaredArtifacts.ts`, ejecutado **tras una puerta
verde** —lo que se comprueba es una afirmación sobre un diff que ya funciona— y
reutilizando el `git status` que ya leía `A1`. Aviso por defecto, error con
`--strict-artifacts`, y `artifacts` como etapa propia en `AttemptRecord`.

### La decisión que hace que esto sea usable

**Solo se comparan declaraciones que nombran un fichero.** La celda de la matriz
es markdown escrito por una persona, y la del andamio dice `` `API /health`,
smoke test `` con `TBD` de artefacto de test. Comparar prosa contra un diff
avisaría en **todos** los proyectos recién creados, y un aviso que casi siempre
se equivoca es un aviso que se aprende a ignorar — que es justo cómo las reglas
solo-`--strict` acabaron sirviendo de nada en `H14`.

El heurístico está sesgado a decir que no: sin espacios, y con separador o
extensión. `src/App.java` sí; `API /health`, `smoke test` y `TBD` no. Una celda
mixta —`` `src/Health.java`, smoke test ``— aporta su ruta y calla lo demás.

### El falso positivo que casi se cuela

El primer agente honesto —creaba correctamente los dos artefactos declarados—
fue reportado como si no hubiera tocado ninguno. La causa:

```
$ git status --porcelain
?? src/

$ git status --porcelain -uall
?? src/Health.java
?? src/test/HealthTest.java
```

**`--porcelain` colapsa un directorio entero nuevo en una sola entrada.** Los
ficheros individuales no aparecen nunca, así que la comprobación concluía que no
se habían escrito. Con `--strict-artifacts` eso rechaza trabajo correcto, que es
exactamente el fallo que esta propuesta decía querer evitar.

Corregido con `-uall` en el único sitio que lee el estado —lo comparten `A1` y
`A2`— y fijado con un test cuyo agente crea ambos ficheros declarados: al quitar
`-uall`, falla.

**El `fix` nombra `--code`, no `--impl`.** Comprobado contra `ReqCommand` antes
de escribirlo: un `fix` que nombra una bandera inexistente es peor que no dar
ninguno.

### A3 · Calidad de escenario en el proyecto, no solo en el pack — **hecho (2026-08-22)**

**Hoy.** `docs/specs/harness.md` lo dice sin rodeos: _«el gate es tan fuerte
como los escenarios del pack»_. Y las ocho reglas que lo comprueban —paso
`When` ausente, `Then` ausente, menos de tres pasos, título genérico, lenguaje
vago (`works`, `correctly`, `TODO`), `Scenario Outline` sin `Examples`, enlace
de plantilla roto, deriva de nombre— viven **solo** en `scripts/lint_pack.ts`
(`lintScenarioQuality` y sus ayudantes, líneas 229-384) y solo se aplican a un `pack.yaml`.

El harness no gatea packs: gatea **proyectos**. Y los features de un proyecto
llegan por tres vías que no pasan por `pack lint`: `change archive`, `req add` y
la mano de una persona. O sea: la regla que protege al harness no se aplica en
el sitio donde el harness corre.

**Propuesta.**

1. Extraer el motor a `scripts/lib/gherkin-quality.ts` — un módulo puro, reglas
   con `code` + `fix`, sin dependencia de `pack.yaml`.
2. `lint_pack` lo consume (sin cambio de comportamiento).
3. `csda validate --strict-scenarios` lo consume sobre `features/**/*.feature`.
4. `harness run` lo exige **antes** de invocar al agente, no después: un
   escenario no falsable no merece 1200 s de agente.

**Rigor.** Es la propuesta que más lo sube. Convierte «el gate es tan fuerte
como tus escenarios» de advertencia en documento a comprobación en CI.

**Coste.** Medio-bajo, y casi todo es refactor de extracción con las reglas ya
escritas y probadas.

> **Corrección posterior (2026-08-22).** Extraer las reglas **sobre el parser
> actual propagaría un defecto**: ese parser es insensible a mayúsculas y
> aprueba escenarios que Cucumber ve vacíos — 27 de los 28 de los packs
> curados. Orden correcto: F2 → F1 → F3 → A3. Ver
> [`valoracion-bdd-gherkin-era-agentes.md`](./valoracion-bdd-gherkin-era-agentes.md).

**Nota de compatibilidad.** Un proyecto adoptado con `adopt` puede tener
docenas de features flojos. Por eso es un flag, no el `validate` por defecto —
y por eso conviene que `csda doctor` lo reporte como hallazgo con su fix, que es
el camino de adopción gradual que la herramienta ya usa en todo lo demás.

### Lo que se hizo

Los cuatro puntos, con una desviación deliberada del primero: el motor **no**
fue a `scripts/lib/`, fue a `packages/core/src/domain/GherkinQuality.ts`. Las
reglas son conocimiento del dominio y no hacen E/S; ponerlas en `scripts/` las
habría dejado en la capa de entrega, que es justo lo que
`tests/unit/architecture.test.ts` impide.

Tampoco se inventó una forma nueva para los hallazgos. ADR-0017 ya fija el sobre
`{ severity, code, message, target?, fix?, file?, line? }`; A3 pedía reglas con
`code` y `fix`, que es exactamente ese sobre. Se reutiliza.

| Consumidor | Qué hace |
|---|---|
| `pack lint` | Consume el motor. Salida **idéntica byte a byte**, comparada contra un pack que dispara las ocho reglas |
| `validate --strict-scenarios` | Las aplica sobre `features/**/*.feature`. Bajo la bandera, los avisos también fallan: pedir estricto y recibir indulgente es el error de H14 con otro traje |
| `doctor` | Los mismos hallazgos como aviso, no como puerta |
| `harness run` | Los exige **antes** de `git worktree add`, del prompt y del agente |

**Por qué solo los errores bloquean el harness.** Un aviso —escenario flaco,
paso vago— debilita la señal; no la falsifica. Bloquear por eso dejaría sin
harness a cualquier repo traído con `adopt`. Un error, en cambio, significa que
Cucumber informa `0 steps · exit 0` y la puerta aprueba el requisito sin haberlo
comprobado. Eso no es una señal débil: es una señal falsa.

La prueba que sostiene la parte del harness no comprueba el mensaje, comprueba
**que el agente no llegó a ejecutarse**: el agente configurado escribe un
fichero testigo, y la prueba exige que ese fichero no exista.

### Lo que destapó

La ruta del feature llega desde `plan --format json` **entre acentos graves** —
`` `features/core/health.feature` `` — porque la matriz la guarda como markdown.
Dos sitios ya tenían su propia copia de esa normalización; la comprobación nueva
iba a ser la tercera. Es la forma de H14 otra vez: varios lectores discrepando
sobre el mismo texto. Y aquí el fallo es **silencioso**: una ruta sin limpiar
sencillamente no existe, así que la comprobación no encuentra nada malo y lo
dice. Ahora hay una sola `featureFilePath()` en el dominio y la usan los tres.

---

## B. Planificación

### B1 · `depends_on` y orden topológico — **hecho (2026-08-23)**

**Hoy** (H12, abierto). El pack declara `requirement_id` por escenario pero no
dependencias entre requisitos. `harness run` sin `--req` procesa en orden de
matriz. REQ-002 se apoyaba en REQ-001 y había que **saberlo** y pasar
`--base-branch harness/REQ-001` a mano. Sin eso: fallo en cascada, y cada fallo
cuesta `max_attempts` × timeout.

**Propuesta.**

1. **Formato.** `depends_on: [REQ-001]` opcional en `requirements` del
   `pack.yaml` y una anotación equivalente en la matriz. Opcional ⇒ no rompe
   ningún pack existente ⇒ `schema_version` menor.
2. **`plan`.** Emite `dependsOn` en el JSON y ordena topológicamente. Ciclo →
   `dependency_cycle`, con las aristas del ciclo en el `target`.
3. **`harness run`.** Apila solo sobre la rama del predecesor **cuando existe y
   pasó**. Predecesor fallido → el dependiente se marca `skipped` con el motivo,
   no se intenta. Un requisito saltado por dependencia no es un fallo y no debe
   contarse como tal en el reporte.
4. **Regalo de H9.** Si el harness apila, sabe cuándo la base va por detrás de
   `main` y puede avisarlo — que es exactamente lo que costó el fallo falso de
   REQ-002.

**Coste.** Medio-alto; el más caro de la lista. También el que más cambia lo que
el bucle desatendido puede hacer de una tacada: hoy una ejecución completa de un
pack con requisitos encadenados no es viable sin conducción manual.

**Prerrequisito.** E1 (H13). Añadir un campo al formato mientras el esquema que
se declara autoridad no se aplica agranda el problema.

### Lo que ya estaba

Tres de las cuatro partes. `plan` emite `dependsOn` y ordena; `runLevels`
programa por niveles y bloquea a los dependientes de un fallo; `deriveBase`
apila sobre la rama del predecesor y `warnIfBaseIsStale` avisa cuando la base va
por detrás — el «regalo de H9». Lo que faltaba era la parte 1: que **un pack**
pudiera declararlo.

### Por dónde viaja, y por qué no por donde parecía

Los requisitos de un pack **no llegan como specs de capacidad** —el documento de
capacidad que cada pack instala es su propia plantilla, y remite a la matriz—,
así que el lector de dependencias, que solo mira `capabilities/<dir>/spec.md`, no
los ve nunca. La matriz es el único sitio donde aterrizan.

Pero la anotación **no puede ir en una celda**. El parser de filas parte por `|`
y exige exactamente diez celdas: cualquier cosa añadida a la fila crea una
undécima y la fila deja de parsear. La anotación sobreviviría a una escritura y
desaparecería en el siguiente `expand` — el peor tipo de fallo, porque funciona
cuando lo pruebas.

Va en su propia línea bajo la tabla:

```
<!-- specgate:trace REQ-002 depends=REQ-001 -->
```

Las líneas que no empiezan por `|` ya las ignora el parser de filas, así que la
ida y vuelta es segura **por construcción** y no por cuidado. Hay test de la
segunda vuelta, que es la que se pierde.

### El defecto que destapó al ejecutarlo

`B2` pasaba `blockedBy` a la comprobación de preparación. Ese dato viene del
plan tomado **antes** de la ejecución, así que un requisito cuyo predecesor
acababa de pasar *en esa misma ejecución* seguía leyéndose como bloqueado:

```
❌ REQ-002: it depends on REQ-001, which is not done.
   …instantes después de que REQ-001 pasara y su rama fuera la base de REQ-002
```

Con `--skip-not-ready` eso habría saltado trabajo que el planificador había
desbloqueado correctamente. `runLevels` es la autoridad sobre el orden durante
una ejecución; la preparación responde a las preguntas que el planificador no
puede. Quitado, con test.

### B2 · Preparación del requisito antes de gastar tokens — **hecho (2026-08-22)**

**Hoy.** `plan` ya clasifica `NEEDS_FEATURE` / `NEEDS_EVERYTHING`
(`scripts/plan.ts:158-166`), pero `harness run` no lo usa como filtro: entrega
igual un requisito cuyo feature no existe y cuya fila no declara artefactos, y
el agente descubre a mitad de camino que tiene que inventarse el criterio de
aceptación. Ese es el intento con peor relación coste/resultado del bucle.

**Propuesta.** Una **preparación** explícita por requisito, calculada, no
opinada:

| Comprobación                               | Bloquea       |
| ------------------------------------------ | ------------- |
| El feature existe                          | Sí            |
| Sus escenarios pasan la calidad de A3      | Sí            |
| La fila declara test y artefacto técnico   | No — advierte |
| Sus dependencias están verdes (B1)         | Sí            |
| El requisito no está `Deprecated` / `Wont` | Sí            |

Expuesta en `plan --json` como `ready: bool` + `blockers[]` con `fix` cada uno,
y `harness run --skip-not-ready` (por defecto: avisa y sigue, para no cambiar
comportamiento en una minor).

**Coste.** Bajo-medio. Reutiliza la clasificación existente y A3.

**Qué compra de verdad.** Convierte «planificación» en algo comprobable. Hoy la
respuesta a _«¿está esto listo para un agente?»_ es la intuición de quien lanza
el comando.

### Lo que se hizo

`packages/core/src/domain/RequirementReadiness.ts` — sin E/S: si un fichero
existe y qué dicen sus escenarios son **hechos** que reúne quien llama; si esos
hechos suman «listo» es una **regla**. `plan --json` expone `ready` y
`blockers[]`, cada bloqueador con su `fix`, y `harness run --skip-not-ready`
los usa como filtro.

### Dos desviaciones deliberadas

**`Needs Clarification` también bloquea.** No estaba en la tabla —la propuesta
decía `Deprecated` / `Wont`, y `Wont` ni siquiera existe en
`ALLOWED_STATUS`— pero es el mismo tipo de fallo: un agente al que se le pide
zanjar una discusión la zanja **adivinando**, y la adivinanza llega vestida de
puerta verde.

**Los avisos de artefacto son dos, no uno.** La tabla dice «la fila declara test
y artefacto técnico». La primera versión avisaba solo si faltaban ambos, que es
más silenciosa pero menos útil: «no hay artefacto de test» y «no hay artefacto
de producción» tienen `fix` distintos, y un aviso vago se contesta vago.

Y no es el ruido que `A2` tuvo que evitar: ahí el problema era tratar prosa como
ruta, un falso positivo. Aquí `TBD` en la columna de test es un **hecho cierto**
sobre una fila incompleta, y TDD dice que esa columna es la primera que se
rellena.

### La guarda de A3, absorbida sin perder nada

`A3` ya bloqueaba por escenario no ejecutable. Se unificó con esta comprobación,
pero el reparto no es uniforme:

- **escenario no ejecutable → salta siempre**, con bandera o sin ella. Cucumber
  aprueba un escenario vacío, así que la señal de recompensa es falsa y una
  ejecución verde no probaría nada (`H14`).
- **cualquier otro bloqueador → avisa y ejecuta**, salvo `--skip-not-ready`. El
  comportamiento por defecto no cambia: esto sale en una minor.

Al unificarlas se coló una regresión que un test cazó: el bloqueador de
preparación dice *que* el escenario no puede fallar, pero los hallazgos de `A3`
decían **qué línea y qué palabra clave**. Colapsarlos en un resumen habría
costado la única parte sobre la que una persona puede actuar directamente. Ahora
se imprimen los dos.

### B3 · `--by-scenario` — entregar un requisito grande por partes

**Hoy.** La unidad indivisible es el requisito. Uno con seis escenarios llega
entero, con seis criterios de aceptación en un solo contexto, y un fallo en el
quinto se reporta como «el requisito falló». El ciclo de cambio ya tiene
`tasks.md`, pero el harness no lo lee.

**Propuesta.** `harness run --by-scenario`: cuando el requisito declara varios
escenarios, se entregan en intentos sucesivos **acumulativos sobre la misma
rama** — escenario 1 verde, commit, escenario 2 con el anterior ya en verde. La
sustitución `{scenario}` en el comando de gate ya existe
(`scripts/harness/run.ts:222-233`), así que la maquinaria de filtrado está
puesta.

**Coste.** Medio.

**Honestidad sobre esta.** Es la única de la lista que propongo **sin
convicción de diseño**. La lección de §12.11 es que estos defectos solo aparecen
ejecutando, y esta cambia la forma del bucle. Debería probarse en una ejecución
real —una rama, un requisito de varios escenarios— antes de comprometerse a la
interfaz.

---

## C. Operación desatendida

### C1 · Presupuesto y paralelismo con tope

**Hoy.** Secuencial y sin techo. `max_attempts` es lo único que limita el
gasto. Catorce requisitos × 3 intentos × 1200 s son horas sin control y una
factura sin límite — y la tercera ejecución real terminó porque **la cuenta
agotó su límite mensual**, que es la forma cara de descubrir que no había una
barrera propia.

**Propuesta.**

- `--max-parallel <n>`: los worktrees ya están aislados por construcción, así
  que el paralelismo es seguro **entre requisitos sin arista de dependencia** —
  y B1 es quien sabe cuáles son. Sin B1, `--max-parallel` es una forma rápida
  de multiplicar los fallos en cascada; con B1, es lo que hace viable una
  ejecución nocturna.
- `--budget-seconds` y `--max-requirements`: techo global. Al agotarse, parada
  limpia que **emite el reporte de lo hecho** en vez de morir a media
  ejecución.
- Coste opcional declarado por perfil (`cost_per_run_hint`) para que el reporte
  pueda decir algo sobre gasto sin pretender medir tokens de un agente que no
  los publica.

**Rigor.** Neutro sobre el gate. El paralelismo no relaja ninguna comprobación:
cada worktree pasa el mismo gate.

### C2 · Historial de ejecuciones y efectividad del gate — **hecho (2026-08-22)**

**Hoy.** Cada `harness run` se olvida. Los prompts se archivan en
`.specops/harness-prompts/`, pero **el resultado no**: no hay serie temporal, no
hay tasa de aprobación al primer intento, no hay distribución de etapa de fallo.

El propio `mejoras/analisis-infoq-sdd-enterprise.md` §5 señala la «efectividad
del mecanismo de validación» como _nuestra_ métrica —y la que descubrimos
rota—, y la conclusión de §12.11 es literal: «los defectos de este tipo solo
aparecen ejecutando». Hoy cada ejecución tira la evidencia que produce.

**Propuesta.**

1. `.specops/harness-runs.jsonl` — una línea por intento: requisito, timestamp,
   perfil de agente, duración, resultado, etapa del gate, hash del prompt, sha
   del commit resultante. Formato de una línea por evento porque es lo que
   sobrevive a un proceso que muere a mitad.
2. `csda harness report [--format json|html]` — agrega: intentos por requisito,
   aprobación al primer intento, dónde falla el gate, requisitos que consumen
   todos los intentos.
3. `csda harness report --mark-false-failure REQ-002 --reason "..."` — la pieza
   que falta para medir la ratio de fallo real frente a fallo falso. Sin una
   marca humana esa ratio no es calculable, y es la métrica que el análisis
   InfoQ señala como la más nuestra.

`scripts/report.ts:104-134` ya tiene el patrón de historial con sparkline;
esto es el mismo patrón sobre otro evento.

**Coste.** Medio-bajo.

**Y encaja con P2.** Publicar ese historial en `studio` / `report` es lo que le
da a un product owner respuesta a «¿qué hizo la máquina anoche?» — que es una
pregunta bastante mejor que la que P2 responde hoy.

### Reescoped contra lo que ya existía

Esta propuesta abre con «cada `harness run` se olvida». Dejó de ser cierto con
`E1-04`, que añadió el libro de ejecuciones (`.harness/runs/*.json`) y las dos
métricas de coste. Construir el punto 1 tal cual —un `.jsonl` nuevo por intento—
habría sido un segundo sitio donde vive el mismo estado, que es exactamente lo
que `sustituir-traceability-md.md` concluyó que no hay que hacer. El `attemptLog`
del libro ya trae una entrada por intento.

Lo que **sí** faltaba, y se hizo:

| Pieza | Por qué importa |
|---|---|
| **Dónde acaban los intentos** | Contado por intento, no por veredicto: un requisito que pasó al tercero falló dos veces, y esos dos son los interesantes. Vale más ahora que cuando se escribió C2, porque `A1` y `A2` metieron dos etapas nuevas — un intento rechazado por editar la spec no es lo mismo que uno que falló sus tests |
| **Requisitos que agotan el presupuesto** | Los que cuestan `max_attempts` × timeout y no entregan nada |
| **Serie temporal** | Para ver moverse una tasa en vez de suponerla |
| **`--mark-false-failure`** | La métrica que el análisis InfoQ señala como la más nuestra |

### La parte que no es derivable, y por qué se queda en blanco

Una puerta que rechaza trabajo bueno y una puerta que caza un defecto real
**se ven idénticas en el libro**. Ningún dato registrado las separa: solo alguien
que mire puede decir cuál fue. Por eso es un comando y no un cálculo, y por eso
la tasa se muestra `—` hasta que existe la primera marca.

Devolver `100%` mientras no haya marcas habría sido la mentira más halagadora
posible sobre nuestra propia puerta. `--reason` es obligatorio por lo mismo: un
número que nadie puede auditar después es peor que un blanco honesto.

Las marcas se anexan una por línea a `.harness/false-failures.jsonl` —lo que
sobrevive a un proceso que muere a mitad, igual que el libro— y aplican al
**requisito**, no a una ejecución suya: lo que la persona afirma es «la puerta se
equivocó con REQ-002».

### El filtro que una mutación destapó

Una marca que nombra un requisito que **pasó** no debe contar. La primera
versión del test no distinguía nada: sin fallos en el libro, la tasa salía `null`
con filtro y sin él. El caso que sí separa es más fino — hay un fallo real, y la
marca nombra otro requisito que pasó: sin el filtro, `marked.size > 0` hace
calculable la tasa y se publica **100% de fallos reales** apoyándose en una
errata sobre otra cosa. Ahora hay test para ese caso.

### Lo que se deja fuera, y por qué

`--format html`. `--json` ya cubre el consumo por herramientas y la salida de
terminal es el uso diario; una plantilla HTML nueva es coste medio para valor
bajo comparada con las cuatro piezas de arriba. Si `P2` lo pide, se hace ahí,
que es donde el propio texto dice que encaja.

### C3 · `--resume` — **hecho (2026-08-22)**

**Hoy.** Una rama `harness/REQ-NNN` existente se **salta**, salvo `--force`,
que la **borra y la recrea** (`scripts/harness/run.ts`, `processRequirement`).
No hay término medio: tras un corte —caída, Ctrl-C, límite de gasto— o pierdes
el trabajo o no puedes continuar.

**Propuesta.** `--resume` reutiliza rama y worktree existentes y arranca en el
intento siguiente, leyendo el último fallo del historial de C2 para reinyectarlo
en el prompt. Con H5 ya arreglado (el intento fallido se comitea), la
información necesaria está en la rama; solo falta el comando que la recoja.

**Coste.** Bajo. Cierra directamente el escenario real que ya ocurrió.

### Lo que se midió antes de escribirlo

La propuesta decía leer el último fallo «del historial de C2». Se comprobó
matando una ejecución con `kill -9` y mirando qué queda:

```
rama harness/REQ-000        existe, en base — sin commits
worktree                    sigue registrado, con el trabajo parcial sin commitear
.harness/runs/              vacío
.specops/harness-prompts/   REQ-000-…-attempt-1-agent.md
```

**El libro de ejecuciones no sirve como fuente.** Se escribe cuando una
ejecución *termina*, y `--resume` existe justo para las que no terminan.
Haberlo usado habría dado un `--resume` que funciona en todos los casos menos
en el suyo.

Lo que sobrevive es el archivo de prompts, y da la casualidad de que lleva el
número de intento en el nombre. Se añadió para poder revisar, no para esto —
por eso ahora está anotado que el formato del nombre es **portante** para
`--resume`, y fijado con test, para que nadie lo «ordene» más adelante.

Se lee igual en los dos finales: sin commitear en el worktree superviviente tras
un corte, y commiteado en la rama por `preserveFailedAttempt` cuando se agotan
los intentos, de modo que un worktree nuevo lo saca del checkout.

### Cortado y agotado no son lo mismo

| Última ejecución | Evidencia | Reanuda en |
|---|---|---|
| Intentos agotados | commit `wip(…): FAILED the gate` | el intento siguiente |
| Interrumpida | no hay tal commit | el intento que se cortó |

Un intento que murió **nunca llegó a un veredicto**: la puerta no llegó a
correr, así que no se aprendió nada. Cobrárselo a `max_attempts` sería gastar
presupuesto sin información. El fallo que la puerta sí llegó a reportar se
recupera del prompt archivado que lo llevaba, así que el intento reanudado no
empieza a ciegas.

### Detalles que costaron una corrección

- **`--force` y `--resume` juntos se rechazan.** Son opuestos, y elegir uno en
  silencio es cómo se borra el trabajo tras un corte — la pérdida que `--resume`
  existe para evitar.
- **`--resume` sobre un requisito que nunca empezó lo ejecuta**, no protesta:
  sobre un plan entero, no puede convertirse en «no hagas nada salvo que todo se
  hubiera intentado ya».
- **La limpieza borra el worktree reenganchado, no el que se habría inventado.**
  `git worktree remove` sobre una ruta inexistente falla en silencio, así que el
  superviviente se habría quedado registrado tras cada resume y la lista habría
  crecido sin límite, sin que nada lo dijera. Lo destapó una mutación que ningún
  test cazaba; ahora hay uno.

---

## D. Contexto del agente

### D1 · Perfil por requisito, no por ejecución — **hecho (2026-08-23)**

**Hoy.** `.harness/profiles.yaml` existe y `agent_profile` resuelve **uno** para
toda la ejecución (`scripts/harness/config.ts:118-141`). Un requisito de
infraestructura y uno de dominio reciben el mismo prefijo de prompt y las mismas
herramientas permitidas.

**Propuesta.** Selección por coincidencia, con el bounded context —que ya está
en el modelo— como criterio natural:

```yaml
profiles:
  infra:
    agent: "claude -p --allowedTools Read Write Edit 'Bash(terraform:*)' < {prompt_file}"
    prompt_prefix_file: ./.harness/infra-prefix.md
    match: { bounded_context: Platform }
  domain:
    agent: "claude -p --allowedTools Read Write Edit 'Bash(npm:*)' < {prompt_file}"
    match: { bounded_context: "*" }
```

Primera coincidencia gana; sin coincidencia, el perfil por defecto. Es la §2.3
del análisis InfoQ aterrizada: lo que allí faltaba era **qué perfil aplica a qué
requisito**, y el bounded context lo responde sin inventar taxonomía nueva.

**Rigor.** Sube por un lado poco obvio: las herramientas permitidas dejan de ser
el máximo común denominador de todos los requisitos. Un requisito de dominio no
necesita `Bash(terraform:*)`.

**Coste.** Bajo-medio.

### El criterio no existía, y medirlo lo demostró

La propuesta dice «el bounded context —que ya está en el modelo— como criterio
natural». Está en el modelo del **pack**; no era alcanzable desde un requisito.
Medido sobre los once packs curados:

```
escenarios: 27 | con aggregate propio: 0 | via use case: 0
packs: 11 | con bounded_contexts declarados: 10
```

Diez packs declaran contextos y **ningún escenario** enlaza con un agregado, ni
directamente ni por su caso de uso. Emparejar por ese criterio no habría casado
nunca: caída al perfil por defecto siempre, con la configuración escrita y sin
efecto. Una función que parece funcionar y no hace nada — la familia de `H14`
otra vez.

El enlace sí existe una vuelta más allá: **caso de uso → comando → agregado →
contexto** resuelve para **los 27**. Así que `expand` lo deriva y lo escribe
junto a la matriz, reutilizando la línea `csda:trace` que `B1` acababa de
introducir:

```
<!-- specgate:trace REQ-002 depends=REQ-001 context=Payments -->
```

Por **nombre**, no por id: `Payments` es lo que una persona escribe en `match:`;
`BC-002` es un identificador que nunca eligió.

### Decisiones que merecen constar

- **Un perfil sin `match:` no es una regla.** Se elige por nombre con
  `agent_profile`. Tratar la ausencia como «casa con todo» haría que el primer
  perfil del fichero se tragara todos los requisitos en cuanto alguien añadiera
  una regla a otro.
- **Una clave desconocida no casa nada**, en vez de ignorarse: `bounded_contex:`
  —una letra de menos— no puede convertirse en silencio en una regla que casa
  con todo.
- **`*` significa «cualquier contexto», no «sin contexto».** Un requisito que la
  herramienta no supo situar cae al perfil por defecto, en lugar de recibir las
  herramientas del último perfil del fichero.
- **La escalera de roles gana en su paso.** Si `attempt_profiles` nombra un
  perfil para *ese* paso, el paso ya ha respondido a la pregunta.

### El mismo fallo silencioso, por tercera vez

Las reglas viven en `.harness/profiles.yaml`, pero se leían **a través** del
lector de `harness.config.yaml`. Un proyecto con perfiles y sin config —que es
exactamente el que se usa para probar— no veía ninguna regla, y el emparejado
sencillamente no ocurría, sin decir nada.

Es la tercera vez que aparece este patrón: pasó con `cost_per_run_hint` en `C1`
y con los hints del informe. Ahora hay test que ejecuta el harness en un
proyecto **sin** `harness.config.yaml` y exige que el emparejado funcione.

### D2 · Precedentes del repositorio en el prompt

**Hoy.** `buildPrompt` inyecta facts, Gherkin, `AI_RULES.md` y definición de
hecho. Todo correcto y todo **normativo**. Lo que no inyecta es un ejemplo: un
agente sin historial de conversación no sabe cómo se ve en este repositorio una
implementación **ya aceptada**.

**Propuesta.** Sección «Precedentes», opt-in (`prompt_precedents: 1`): del
último requisito `Verified` del mismo bounded context, las rutas de su test y su
artefacto técnico y las primeras N líneas de cada uno, sacadas de la matriz.
Determinista, sin llamada a modelo, acotado por tamaño.

**Coste.** Bajo.

**Riesgo, dicho de frente.** Alarga el prompt y puede fosilizar una convención
mala. Por eso: opt-in, acotado, y elegido entre los `Verified` —que son los que
ya pasaron una revisión humana.

### D3 · Verificación adversarial opcional

**Propuesta.** `verifier_agent` en `harness.config.yaml`: un segundo pase que
recibe el diff y el escenario y devuelve `{ verdict, findings[] }` en JSON. Con
una regla dura: **solo puede rechazar**. Nunca puede aprobar lo que el gate
determinista rechazó, ni convertir un `fail` en `pass`.

**Dónde va: después de A1–A3, no antes.** Añadir un juez de IA antes de tener
las guardias deterministas sería sustituir rigor por opinión — y esa es la
crítica que este proyecto ya le hace al artículo de InfoQ en §3 del análisis:
afirmaciones de organización sin evidencia de operación. Candidata a post-1.0.

**Coste.** Medio.

---

## E. Prerrequisito documental

### E1 · H13 antes de tocar el formato de pack

H13 sigue abierto: ADR-0020 declara el JSON Schema «única autoridad» y el CLI no
valida contra él; los once packs curados fallarían el esquema hoy.

B1 añade un campo (`depends_on`) al formato. Añadir campos a un formato cuyo
esquema afirma una autoridad que no ejerce **agranda la mentira**: cada campo
nuevo es uno más que el esquema declara gobernar y no gobierna. La decisión que
H13 ya plantea —aplicarlo de verdad y migrar los packs, o rebajar ADR-0020— hay
que tomarla antes de B1, no después. No es trabajo extra de esta propuesta: es
orden de ejecución.

---

## 3. Lo que descarto

| Idea                                              | Por qué no                                                                                                                                                       |
| ------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Que el harness mergee lo verde**                | Es la premisa del producto al revés. «El harness nunca mergea» es lo que hace revisable el resultado. `--push` + `--pr-cmd` ya cubren la parte automatizable     |
| **Orquestación multi-repo (P1)**                  | Coincido con la decisión ya tomada: cambio de modelo, no función. `alm sync` es el puente barato. v2                                                             |
| **«Solo los agentes escriben código»**            | Ya rechazado en §3 del análisis InfoQ y por buenos motivos medidos. Ninguna de estas propuestas lo asume                                                         |
| **Renombrar `harness` por la colisión con InfoQ** | Coincido con la opción 3 ya elegida: apropiarse del término cuesta un párrafo; renombrar gasta la racha de dos releases sin breaking                             |
| **Estimación de esfuerzo por LLM en `plan`**      | Añade un modelo a un comando hoy determinista. `plan` tiene que poder correr en CI sin credenciales. Toda la planificación propuesta aquí (B1, B2) es calculable |

## 4. Orden de ejecución recomendado

**Tanda 1 — el gate primero.** A1, A2, A3. Ninguna depende de otra cosa, todas
suben el rigor, y son lo que hace que las siguientes no amplifiquen errores.
Encaja en el alcance de 1.0: no cambia formato ni contrato, solo añade
comprobaciones y un flag.

**Tanda 2 — que el bucle rinda desatendido.** C3, C2, B2, luego C1. Barato antes
de caro, y C2 aporta la instrumentación con la que medir si las demás sirven.

**Tanda 3 — cambio de modelo.** E1 (decisión H13) → B1 → C1 con paralelismo →
D1. Es donde está el salto de rendimiento real y también el riesgo: toca
formato. Post-1.0.

**Sin fecha:** B3 (probar antes de comprometer la interfaz), D2, D3.

## 5. Encaje con el camino a 1.0

Ninguna de estas propuestas es un gate de 1.0 — G1..G5 siguen siendo lo que son,
y G3 (un equipo de fuera adopta y reporta) sigue siendo lo que de verdad bloquea.

Pero **A1 merece una lectura aparte.** El camino a 1.0 dice que 1.0 significa
que el contrato de agente es estable y que la política de soporte pasa de
intención a promesa. Prometer eso con un bucle en el que el agente puede editar
el fichero que lo juzga es prometer más de lo que el gate sostiene. A1 es de las
baratas; yo la metería antes del 1.0 aunque no esté en la lista de gates.

Y una advertencia que sale del propio historial de este repositorio: la mitad de
lo que hay aquí son hipótesis de diseño. Los diez defectos de §12.11 no
aparecieron leyendo código. **Cada una de estas propuestas debería pasar por una
ejecución real antes de darse por buena** — especialmente B3 y C1, que cambian
la forma del bucle.
