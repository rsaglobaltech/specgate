<!-- translation-of: ac843f3d90d7 -->
# Validar

Al final de esta página el gate se ejecuta en tu máquina antes de cada pull
request, y en CI como check obligatorio que bloquea un merge cuando falla. El
**gate** es el conjunto de checks que decide si la especificación y el código siguen de acuerdo.

**Necesitas:** un proyecto donde se haya ejecutado `specgate init`, Specgate
instalado como dependencia de desarrollo (`npm install --save-dev @rsaglobaltech/specgate`)
y, para la parte de CI, un repositorio en GitHub, GitLab, Azure DevOps o Jenkins.

> **¿Nuevo en el gate?** [El gate, paso a paso](gate/index.md) lo recorre en
> tu máquina, en CI para cada proveedor, adoptándolo con una baseline y
> leyendo un fallo. Esta página es la referencia de lo que comprueba `validate`.

## Ejecuta el gate en tu máquina: `specgate check`

```bash
specgate check
```

`check` ejecuta estas etapas en orden, y se detiene en la primera que falla:

1. Los ids frente a la rama base (abajo); con `--base`, lo que la rama
   cambia en los controles, nombrado para quien revisa.
2. Cada change abierto, tal como lo aprobó una persona: requisitos, alcance del diseño, tests de aceptación sellados.
3. `validate --strict`: specs, escenarios, trazabilidad, enlaces y cobertura.
4. Tu check de arquitectura (`specgate config set arch_cmd "<cmd>"`: ArchUnit,
   dependency-cruiser…); con `arch_sarif:`, solo falla una violación que añade el change.
5. Tus tests (`test_cmd`, o `--test-cmd`), junto al paso 4
   ([`gate_parallel: false`](fast-gate.md) los ejecuta uno tras otro).
6. Con `bdd: required`, los escenarios de cada requisito entregado (`bdd_cmd`;
   `--no-scenarios` los omite).
7. Los tests de aceptación sellados, con `acceptance_cmd`.
8. Tus [checks de calidad](quality.md), si `specgate quality init` los escribió:
   cobertura y mutación de lo que añade el change, SAST, secretos, dependencias,
   Conventional Commits, cada uno en Docker. `--ci` añade los que son solo de CI
   y hace fallar un check que no puede ejecutarse.

Sin comando de tests, `check` pasa igualmente y dice que comprobó la especificación, no el código. Configura uno.

`check` también compara los ids de requisitos con la rama base (`--base <branch>`,
o la rama por defecto de origin). El mismo id con otro título allí hace fallar
el gate como `id_taken_on_base`, antes de que dos pull requests choquen al hacer merge.

Ejecuta `check` antes de cada pull request. `specgate apply` ejecuta el mismo
gate para el único requisito que entrega.

### Ejecuta solo lo que toca el change: `check --affected`

`specgate check --affected` ejecuta los tests de lo que cambió desde la rama
base —a través de `{files}` en `test_cmd_affected:`— y la suite completa,
diciendo por qué, siempre que no puede saber qué necesita el change. Un test
que pasó sobre el mismo código no se vuelve a ejecutar. `check` sin flag, y
`check --ci` siempre, ejecutan la suite completa. Ver [Un gate más rápido](fast-gate.md).

### Las etapas, y el último resultado

Con `--json`, cada respuesta —aprobada o fallida— lista las `stages` del gate
en el orden en que las ejecuta: `ids`, `changes`, `validate`, `architecture`, `tests`,
`scenarios` (con `bdd: required`), `acceptance` (cuando un change abierto selló
tests de aceptación), y luego una etapa `quality` por check, con su `name`. Cada una tiene su `command`
(`null` cuando no tiene), su `result` (`passed`, `failed`, `skipped` cuando no
está configurada o no pudo ejecutarse, `not run` cuando falló una etapa anterior),
su `ms` (`null` cuando no se ejecutó) y sus `findings`, cada uno con `code`,
`message`, `fix`, `file` y `line` cuando los tiene; `selection` dice qué tests
se ejecutaron ([Un gate más rápido](fast-gate.md#que-dice)). La etapa `validate` lleva los hallazgos del propio validate, así que una herramienta
no tiene que volver a ejecutar `validate --json`. Un gate fallido mantiene `check: null`
y sus hallazgos en `status`.

Cada check que llega a un veredicto también guarda su resultado, en la carpeta
git del repositorio (`.git/specgate/last-check.json`, o `.specgate/`, ignorada
allí, fuera de git), así que `git status` queda como estaba. Léelo sin ejecutar
el gate:

```bash
specgate check --last          # passed or failed, when, on which commit, each stage
specgate check --last --json   # lastCheck: ranAt, commit, branch, dirty, passed, ci, stages
```

Sin ningún check ejecutado todavía, `lastCheck` es `null` y el hallazgo
`last_check_none` da la corrección `specgate check`. Desde Node, `lastCheck(dir)`
de la API responde lo mismo.

## Ejecútalo en CI

`specgate init` y `specgate adopt` ya escribieron el job: el gate de
especificación, para el proveedor de CI que muestra el repositorio (GitHub
cuando no muestra ninguno). Mira qué comprueba y qué le falta:

```bash
specgate ci status
```

Prepara la toolchain del proyecto (Node, o un JDK para Maven y Gradle) y
ejecuta `specgate check` en la versión que lo escribió, así que un verde en tu
máquina es un verde en CI. En GitHub el job se llama `spec-gate` y se ejecuta
en Ubuntu, macOS y Windows, compara los ids de requisitos con la rama base,
ejecuta los [checks de calidad](quality.md) cuando están configurados,
comprueba los [packs](supply-chain.md) y mantiene el plan de trabajo
pendiente. Comprueba más, no menos: cada paso dice en el YAML qué comprueba y
qué borrar para quitarlo, y un paso cuya herramienta aún no está configurada lo dice y pasa.

- `specgate ci init --provider gitlab` (o `azure`, `jenkins`) lo escribe para
  otro CI; `--force` lo vuelve a escribir; `--minimal` (solo GitHub): un job en Ubuntu, solo `check`.
- Un `specgate init` antiguo escribía `.github/workflows/specs.yml`, que solo
  validaba la especificación: `specgate ci init --provider github` muestra lo
  que añade el gate, `--replace` lo sustituye.
- `specgate init --no-ci` no escribe ningún archivo de CI.

Si escribes el job a mano, ejecuta `validate --strict` y fija la versión. Una
versión nueva puede cambiar lo que comprueba el gate, y un pipeline no debería
cambiar bajo una rama en verde:

```yaml
# .github/workflows/specs.yml
name: Spec gate
on: [push, pull_request]
jobs:
  spec-gate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '24' }
      # --strict is the whole specification gate, pinned so a release
      # cannot change it under you. It does not run your tests.
      - run: npx --yes @rsaglobaltech/specgate@1.7.0 validate . --strict
```

`validate --strict` comprueba solo la especificación. Para que el job falle
también cuando fallan los tests, ejecuta `check`, como hace el job generado.

## Conviértelo en check obligatorio

Un job de CI que falla no impide un merge por sí solo: haz de `spec-gate` un
check obligatorio de tu rama principal. Dónde está ese ajuste en GitHub, GitLab,
Azure DevOps y Jenkins: [El gate en CI](gate/ci.md#conviertelo-en-check-obligatorio).
[El primer pull request de tu equipo](first-pr.md) cubre lo que hacen el autor y
quien revisa una vez que el check está en su sitio.

## Qué comprueba `validate`

Un simple `specgate validate .` comprueba la estructura que necesita todo proyecto:

- los directorios `features/` y `docs/specs/`,
- `spec.md`, `AGENTS.md`, la matriz de trazabilidad y el índice de ADR,
- al menos un archivo `.feature`, y ningún placeholder `{{...}}` sin resolver,
- cada archivo `.feature` aparece en la matriz, con un estado permitido,
- ningún id de escenario duplicado,
- los deltas de cada change abierto.

El código de salida `0` significa que pasó, también con avisos; `1` significa que encontró algo.

### Lo que añade `--strict`

`--strict` es el gate. Añade cinco checks en un solo flag:

| Check | Qué falla |
| --- | --- |
| TDD | Un requisito más allá de Draft sin test, sin escenario o sin fila en la matriz. |
| Escenarios | Un escenario que no puede fallar: sin pasos, sin `When`/`Then`, pasos vagos. |
| Requisitos | Un requisito que no enuncia ninguna obligación (`SHALL`, `MUST`, …). |
| Enlaces | Una fila entregada que apunta a un archivo que ya no existe. |
| Cobertura | Un escenario declarado que ningún test nombra. |

Cada check tiene también su propio flag (`--strict-tdd`, `--strict-scenarios`,
`--strict-requirements`, `--strict-links`, `--strict-coverage`), para que un
pipeline existente siga significando lo que significaba. Usa `--strict` en todo
lo nuevo: uno de los flags individuales por sí solo deja pasar un requisito
cuyo archivo de test no existe.

Siguen los detalles de cada check.

### TDD: los requisitos en Draft aún no deben nada

Un requisito que nadie ha empezado está exento, y la ejecución dice cuántos
omitió:

```
- Strict TDD gate: passed (3 row(s) exempt — still Draft, so not checked)
```

Un requisito se comprueba desde el momento en que su estado deja Draft, que es
lo que hace `specgate apply`. Un requisito que no vas a entregar se marca
Deprecated (`specgate apply REQ-NNN --status Deprecated`) y también se omite.

### Escenarios: cada uno puede fallar

Sobre `features/**/*.feature`:

- Ningún escenario que Cucumber vería como vacío. `GIVEN`/`WHEN`/`THEN` en
  mayúsculas es la causa habitual: las palabras clave de Gherkin distinguen
  mayúsculas, así que el escenario ejecuta cero pasos y pasa.
- Cada escenario tiene un `When` y un `Then`, al menos tres pasos y un título
  que nombra el comportamiento.
- Ningún texto de paso vago, y ningún `Scenario Outline` sin `Examples`.

`specgate doctor` informa de las mismas reglas como avisos, que es el camino
gradual para un repositorio que trajiste con `specgate adopt`.

### Requisitos: cada uno enuncia una obligación

Sobre `docs/specs/capabilities/**/spec.md`, cada requisito usa `SHALL`,
`MUST`, `SHOULD`, `MAY`, `DEBE` o `DEBERÁ`, y uno que empieza con `IF`
se resuelve con `THEN` en la misma frase. No analiza la gramática EARS: estas
dos reglas son lo que una coincidencia de patrones puede comprobar con honestidad.

### Enlaces: las filas entregadas apuntan a archivos reales

Cada archivo feature, artefacto técnico y artefacto de test que nombra una fila
entregada (`Implemented`, `Verified` o `Released`) debe existir. Una fila en
Draft puede nombrar un archivo que aún no está escrito. Una ruta puede llevar
un rango de líneas (`src/auth/login.ts#L15-L89`); el rango no forma parte de la ruta.

Las reglas de escenarios funcionan igual: la mayoría se deben al entregar,
incluida `scenario_placeholder_step`, el `<placeholder>` que `specgate new`
deja para que lo rellenes. Las tres que hacen que una suite informe de un pase
que nunca ejecutó (sin pasos, una palabra clave con las mayúsculas mal, un
Outline sin Examples) se aplican a todas las filas.

### Cobertura: cada escenario lo nombra un test

Una fila de la matriz nombra un escenario y un archivo feature, pero el archivo
puede contener cinco escenarios. La cobertura comprueba cada uno de ellos:

```
  ✖  Declared scenarios nothing proves: 1
  ✖  Nothing proves "SCN-012 a fully discounted invoice carries no tax"
     fix: Add a test naming SCN-012 to tests/totals.test.js, or delete the
          scenario if it no longer describes behaviour this project promises.
```

Esto detecta el escenario que un agente se salta cuando no puede cumplirlo.
Busca la etiqueta `@SCN-NNN` de un escenario, el id en su título o el propio
título en el test que declara la fila. Es una coincidencia de nombres y no ejecuta tu suite.

En un repositorio adoptado con tests escritos años antes, ningún test nombra
todavía un requisito. Entonces el check informa de que no pudo ejecutarse en
lugar de hacer fallar todas las filas:

```
⚠ --strict-coverage could not run: no test artifact in this project names its
  requirement or any of its scenarios.
```

Nombra un requisito en el test que lo demuestra (basta un comentario), y el
check empieza a exigir lo mismo al resto de la matriz.

## Un pase en un repositorio recién adoptado

Un repositorio pasa el gate el día que lo adoptas, para que adoptar nunca
rompa un build. `validate` avisa mientras el único escenario siga siendo la
baseline que escribió `adopt`:

```
✅ Validation passed
  ▲  Adoption never retro-filled — the only scenario is the adoption baseline.
```

El código de salida sigue siendo `0`. En `--json`, `validation.adoptionRetrofilled`
lleva el mismo hecho, con un aviso `adoption_not_retrofilled` en `status[]`.

## Deriva de valores declarados: un informe, no un gate

El gate no puede saber cuándo el spec y el código existen ambos y no coinciden,
por ejemplo un timeout de sesión de 30 minutos en el código y de 15 en el spec.
Anota el valor en ambos lados, y `specgate report` los compara:

```markdown
<!-- specgate:trace uc=Login value_session_timeout=15m -->
```

```ts
// specgate:value session_timeout=15m
```

`specgate:value` se busca línea a línea, detrás de cualquier marcador de
comentario. La comparación es igualdad exacta de cadenas: `15m` y `900000` son
valores distintos. Cada valor es **coincidente**, **divergente**, **solo en el
spec** o **solo en el código**, y `specgate report --record` añade los totales
al historial de informes.

Es un informe, no un gate: las anotaciones cubren solo los valores que alguien
decidió anotar ([ADR-0023](specs/adr/0023-checking-content-gate-or-report.md)).

Cuando un valor diverge, tienes tres opciones:

1. **Corrige el código.** El informe da el archivo y la línea.
2. **Actualiza el spec.** `specgate propose <id> --from-value-drift REQ-ID:value_id`
   abre un change cuyo delta lleva el valor del código. Deja la prosa con
   un `TODO:` para que la reformules. Revísalo, entrega el requisito con
   `specgate apply`, y `specgate archive <id>` cuando esté Implemented.
3. **Retira el requisito.** Abre un change con `specgate propose <id>` y
   ponlo bajo `## REMOVED Requirements`.

## Siguiente

- [El primer pull request de tu equipo](first-pr.md) · [Automatización](automation.md) · [Deriva y contratos de API](steering.md)
