<!-- translation-of: 081c55bce4e6 -->
# Configurar el gate

No todos los equipos quieren que cada regla haga fallar un pull request desde
el primer día. Al terminar esta página tu repositorio dice qué exige su gate
—regla por regla: fallar, reportar u omitir— y el gate lo aplica igual en un
portátil y en cualquier CI, con una fecha desde la que cuentan los errores.

**Necesitas:** el gate en marcha ([El gate](index.md)).

## El archivo de política

`.specgate/gate.yaml`, en el repositorio junto al código. `specgate init` y
`specgate adopt` lo escriben con el preset `standard`:

```yaml
preset: standard
rules:
  tdd: error
  scenarios: error
  requirements: error
  links: error
  coverage: warning
  ids: error
  quality: error
  use_cases: warning
  state_machines: error
  scope: warning
  controls: warning
  acceptance: error
# enforce_from: 2026-12-31
# bdd: required
# link: strict
```

Cada regla tiene uno de tres niveles:

| Nivel | El gate |
| --- | --- |
| `error` | falla con los hallazgos de la regla |
| `warning` | los reporta, con `gate_rule_reported`, y pasa |
| `off` | no ejecuta la regla |

**Sin archivo, el gate usa el preset `strict`**, que es lo que
`validate --strict` siempre significó: todas las reglas en `error` salvo
`use_cases` y `controls`, que también en `strict` son warnings. Un proyecto
que nunca escribe una política conserva el gate que tenía.

## Las reglas

| Regla | Falla con | Flag |
| --- | --- | --- |
| `tdd` | Un requisito entregado sin un test que lo nombre | `--strict-tdd` |
| `scenarios` | Un escenario que no puede fallar: placeholders, palabras clave en minúscula, sin pasos | `--strict-scenarios` |
| `requirements` | Un requisito sin obligación, o todavía con la frase que escribió Specgate | `--strict-requirements` |
| `links` | Una ruta que declara la matriz y que no existe | `--strict-links` |
| `coverage` | Un escenario de un archivo feature declarado que ningún test nombra | `--strict-coverage` |
| `ids` | Un id de requisito que significa otra cosa en la rama base | — |
| `quality` | Los checks de calidad de `harness.config.yaml` | — |
| `use_cases` | Un requisito que no nombra ningún caso de uso de `docs/specs/use-cases.md`, o un caso de uso que nada entrega | `--strict-use-cases` |
| `state_machines` | Una máquina de estados de `docs/specs/state-machines/` sin inicio, con un estado o requisito que no existe, o con una transición prohibida | — |
| `scope` | Un archivo de código nuevo que el diseño de un change aprobado no nombra, cuando un diseño nombra archivos | — |
| `controls` | Lo que la rama cambia en los controles —el guard, la política del gate, las aprobaciones, la evidencia—, nombrado para quien la revisa (`check --base`) | — |
| `acceptance` | Un test de aceptación que una persona aprobó y que ya no es como se aprobó, o que no pasa con `acceptance_cmd` | — |

Un flag individual siempre falla con su regla, diga lo que diga la política:
un archivo de CI que ejecuta `validate --strict-tdd` sigue significando lo que
significaba.

## Los presets

| Regla | `minimal` | `standard` | `strict` |
| --- | --- | --- | --- |
| `tdd` | error | error | error |
| `scenarios` | error | error | error |
| `requirements` | warning | error | error |
| `links` | error | error | error |
| `coverage` | off | warning | error |
| `ids` | warning | error | error |
| `quality` | warning | error | error |
| `use_cases` | off | warning | warning |
| `state_machines` | warning | error | error |
| `scope` | warning | warning | error |
| `controls` | warning | warning | warning |
| `acceptance` | warning | error | error |

`minimal` falla con lo que deja un requisito sin probar y reporta el resto: un
equipo que está adoptando el gate. `standard` reporta la cobertura, que es una
coincidencia de nombres y no una ejecución de la suite, y los archivos nuevos
fuera del diseño (`scope`). `use_cases` sigue siendo un warning hasta que el
proyecto escribe su catálogo. `controls` es un warning en todos los presets:
desde una rama no se puede saber quién aprobó, así que el gate nombra el
cambio para quien revisa. `state_machines`, `scope` y `acceptance` no dicen
nada en un proyecto sin máquinas de estados, sin un diseño aprobado que nombre
archivos o sin tests de aceptación sellados. `scope` juzga solo los archivos
que git ve como nuevos — sin seguimiento, o añadidos y aún sin commit: una vez
hecho el commit, `scope` ya no los nombra, así que ejecuta `check` antes del
commit. `rules:` sobrescribe cualquier regla del preset.

**Cambiar solo `preset:` no relaja nada de lo que escribió `init`.**
`specgate init` escribe todas las reglas bajo `rules:`, y una regla escrita
ahí gana al preset. Para pasar a `minimal`, borra las líneas de `rules:` que
quieras que decida el preset, o pon cada regla en el nivel que quieras.

## Las otras claves

| Clave | Qué hace |
| --- | --- |
| `preset` | `minimal`, `standard` o `strict`; `strict` si falta |
| `rules` | Un nivel por regla, por encima del preset |
| `enforce_from` | Una fecha, `YYYY-MM-DD`: hasta entonces cada `error` es un warning (abajo) |
| `bdd: required` | Los escenarios son ejecutables: el gate los ejecuta con `bdd_cmd` de `harness.config.yaml` (la etapa Scenarios). `specgate init` la escribe cuando el proyecto tiene un runner para sus archivos feature; si no, `specgate migrate bdd` |
| `link: strict` | Un test vincula un requisito, o un escenario, solo donde nombra su id fuera de un comentario: en el nombre de un test, un tag, un string o el código. Un comentario `// REQ-007` ya no hace del archivo el test de REQ-007, y `apply` lo dice cuando lo rechaza. `test=` en la traza sigue vinculando. Sin ella, o con `link: mention`, cualquier mención vincula |
| `trust` | El nivel de confianza de cada módulo, de 1 a 5, para el harness: `trust: { pagos: 2, catalogo: 4 }`. Cada clave debe ser una capability de `docs/specs/capabilities/`; cualquier otra hace fallar el gate (`pagos is not a capability of this project`). `specgate trust` muestra lo que se ha ganado cada módulo. Un proyecto sin `trust:` no cambia |

Cualquier otra clave hace fallar el gate: en la terminal `check` nombra la
clave (`` `foo` is not a key of the gate policy ``) y falla con
`check_validate_failed`; con `--json`, el hallazgo es `gate_policy_invalid`.

## Endurécelo en una fecha

```yaml
preset: strict
enforce_from: 2026-12-15
```

Hasta esa fecha cada `error` se reporta como warning, y el gate dice hasta
cuándo. A partir de la fecha, los errores lo hacen fallar. El equipo ve
exactamente qué va a fallar, durante el tiempo que necesite para corregirlo, y
nadie tiene que acordarse de editar el archivo de CI.

## Cámbialo sin abrir el archivo

```bash
specgate config set gate.preset minimal
specgate config set gate.rules.coverage off
specgate config set gate.enforce_from 2026-12-15
```

Un valor que la política no podría leer se rechaza antes de escribir el
archivo, con `config_value_invalid` y los valores que se pueden usar.
`specgate config keys` lista las claves.

## Lo que dice el gate

`check` nombra la política vigente y lo que relaja, bajo su cabecera:

```text
  ·  Policy         .specgate/gate.yaml (strict): tdd warning
  ✔  Specification   validate --strict
  ▲  1 tdd finding(s) reported, not failed: .specgate/gate.yaml sets tdd to warning.
```

Con `--json`, los hallazgos reportados están en `status` como warnings, cada
uno con su propio código, más un `gate_rule_reported` por regla. Una política
que no se puede leer hace fallar el gate con `gate_policy_invalid` y todos sus
problemas.

## Siguiente

- [Leer un fallo](failures.md)
- [En CI](ci.md)
