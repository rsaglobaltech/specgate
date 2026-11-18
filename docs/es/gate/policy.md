<!-- translation-of: 89c4acf6c9a8 -->
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
# enforce_from: 2026-12-31
```

Cada regla tiene uno de tres niveles:

| Nivel | El gate |
| --- | --- |
| `error` | falla con los hallazgos de la regla |
| `warning` | los reporta, con `gate_rule_reported`, y pasa |
| `off` | no ejecuta la regla |

**Sin archivo, el gate es estricto**: todas las reglas en `error`, que es lo
que `validate --strict` siempre significó. Un proyecto que nunca escribe una
política conserva el gate que tenía.

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

`minimal` falla con lo que deja un requisito sin probar y reporta el resto: un
equipo que está adoptando el gate. `standard` reporta la cobertura, que es una
coincidencia de nombres y no una ejecución de la suite. `rules:` sobrescribe
cualquier regla del preset.

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
