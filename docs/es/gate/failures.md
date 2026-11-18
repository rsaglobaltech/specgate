<!-- translation-of: fbd1ceb415c7 -->
# Lee un fallo del gate

Cada fallo que reporta el gate dice dónde, qué, su código entre corchetes, y
la corrección en la línea siguiente. Al final de esta página sabes leer
cualquiera de ellos y qué cambiar: en el código, el test, el escenario o
`spec.md`.

## La forma de un fallo

```text
  ✖  Specification   validate --strict

     ◆ specgate · validate   shop

       ✖  --strict-scenarios violations detected: 4 (4 that make a scenario pass without testing anything)
         ✖  features/a-customer-can-place-an-order.feature:5  `given` is not a Gherkin keyword; write `Given`. Cucumber reads it as prose, so the line does nothing.  [keyword_case_invalid]
          fix: Write `Given`.
         ✖  features/a-customer-can-place-an-order.feature:4  scenario_has_no_steps — Cucumber sees no steps here, so this scenario passes without testing anything. If the steps look like they are there, check their keywords: Gherkin is case-sensitive.  [scenario_has_no_steps]
          fix: Write Given / When / Then steps, in that capitalisation.

  ✖  The gate failed: validate --strict.  [check_validate_failed]
     fix: Fix what validate reports above, then run `specgate check` again.
```

Léelo desde abajo: la última línea nombra la etapa que falló
(`check_validate_failed`); encima, cada hallazgo con su archivo y su línea.
Las etapas posteriores a una que falla no se ejecutaron: `specgate check --last`
muestra cada una como `not run`. En CI el mismo texto está en el log del job;
`--json` lo da como datos, cada hallazgo con `code`, `file`, `line` y `fix`.

## La etapa que falló

| Código | La etapa | Qué hacer |
| --- | --- | --- |
| `id_taken_on_base` | Un id de requisito de aquí tiene otro título en la rama base: dos ramas añadieron el mismo `REQ-NNN` | Renumera el tuyo al id que indica la corrección, el siguiente libre en ambos lados |
| `check_change_invalid` | El delta de un change abierto no valida | `specgate change validate <id>` lista cada hallazgo |
| `check_validate_failed` | La especificación: uno de los hallazgos de abajo | Corrige los hallazgos que aparecen encima |
| `check_arch_failed` | Tu `arch_cmd` falló | Mueve el código adonde lo espera la arquitectura, o cambia la regla a propósito |
| `check_tests_failed` | Tu `test_cmd` falló; su salida está encima | Haz que los tests pasen |
| `check_quality_failed` | Un check de calidad encontró algo nuevo, o no pudo ejecutarse con `--ci` | El hallazgo propio de cada check está encima: `quality_check_failed` |
| `baseline_incomplete` | Se pidió a `check --baseline` registrar lo que un baseline no puede contener | Corrige lo que reporta validate y vuelve a registrar: [Adóptalo sin un build en rojo](baselines.md) |

No son fallos; se informan para que sepas qué no se comprobó:
`ids_not_compared` (no hay rama base con la que comparar), `check_not_run` (un
check omitido, con el motivo).

## Los hallazgos de la especificación

### Un escenario que no puede fallar

| Código | Significa | Corrección |
| --- | --- | --- |
| `keyword_case_invalid` | `given`, `when`, `then` en minúscula: Cucumber lee la línea como prosa | Pon la palabra clave en mayúscula inicial |
| `scenario_has_no_steps` | Cucumber no ve pasos, así que el escenario pasa sin probar nada | Escribe pasos `Given` / `When` / `Then` |
| `scenario_placeholder_step` | Un paso aún contiene `<the action under test>`, permitido solo en Draft | Escribe el estado, la acción y el resultado reales |

### Un requisito entregado sin su prueba

Desde el momento en que un requisito está en Implemented, Verified o Released:

| Código | Significa | Corrección |
| --- | --- | --- |
| `strict_tdd_1` | Ningún test nombra el requisito (`TDD-1`) | Escribe un test cuyo nombre o cuerpo diga `REQ-NNN` o uno de sus `SCN-NNN`: esa mención es el enlace. O devuélvelo a Draft. |
| `strict_tdd_2` | Su fila no tiene id de escenario (`TDD-2`) | Etiqueta el escenario con `@REQ-NNN @SCN-NNN` |
| `strict_tdd_3` | Está en `spec.md` y no en la matriz (`TDD-3`) | Dale una sección `## REQ-NNN` y un escenario etiquetado; `specgate new` escribe ambos |
| `scenario_not_covered` | Ningún test nombra un escenario de un feature file declarado | Nómbralo en un test, o borra el escenario si ya no describe un comportamiento |
| `link_without_evidence` | El artefacto de test no nombra ni el requisito ni sus escenarios | Nombra el requisito en el test: una ruta que existe no demuestra nada |
| `requirement_template_obligation` | La obligación en `spec.md` sigue siendo "The system MUST satisfy: …" | Escribe qué debe cumplirse, cuándo y cómo se observa |

### Enlaces que no apuntan a nada

| Código | Significa | Corrección |
| --- | --- | --- |
| `declared_artifact_missing` | Una ruta que declara la matriz no existe | Corrige la ruta, o restaura el archivo |
| `feature_not_in_matrix` | Un feature file que ningún requisito reclama | Etiqueta su escenario `@REQ-NNN @SCN-NNN`, o usa `specgate new` |
| `scenario_id_not_in_feature` | La matriz apunta a un id de escenario que el feature file no lleva | Pon `@SCN-NNN` encima de su línea `Scenario:` |
| `matrix_stale` | La matriz ya no coincide con `spec.md`, las etiquetas y los tests | `specgate check` la regenera: haz commit del resultado |

### Deriva de packs

`validate --against-lock` falla cuando un archivo que generó un pack de
dominio ya no coincide con el digest fijado en `.specops.lock`: un tag movido,
un historial reescrito, un archivo generado editado a mano. Mira
[Cadena de suministro](../supply-chain.md).

## En verde aquí, en rojo en CI

| Por qué | Qué hacer |
| --- | --- |
| CI compara los ids con la rama base y tu ejecución no | `specgate check --base origin/main` en local |
| CI ejecuta la suite completa, `--affected` ejecutó una parte | `specgate check` sin `--affected` |
| Un check de calidad omitido aquí (sin Docker) debe ejecutarse en CI | Arranca Docker y ejecuta `specgate check --ci` |
| Un clon superficial: la rama base no está | `fetch-depth: 0` (GitHub), `GIT_DEPTH: 0` (GitLab) |
| Solo en Windows o macOS: una ruta o un final de línea | El job de GitHub ejecuta los tres por este motivo; `.gitattributes` mantiene estables los finales de línea |
| CI ejecuta otra versión de Specgate | La versión está fijada en el archivo de CI: [Fija la versión](ci.md#fija-la-version-y-muevela-a-proposito) |

Los fallos propios de los checks de calidad (`no report at …`, un hallazgo
igual en cada change, el login de SonarQube) están en
[Calidad: cuando algo sale mal](../quality.md#when-it-goes-wrong). Cualquier
otra cosa: [Resolución de problemas](../troubleshooting.md).

## Siguiente

- [Validación](../validating.md): cada regla que aplica `validate --strict`, en detalle
- [Checks de calidad](../quality.md): cobertura, mutación y seguridad en el gate
