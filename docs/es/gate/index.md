<!-- translation-of: 5264ebf79fd7 -->
# El gate

El gate es lo que hay entre un change y tu rama principal. Demuestra que cada
requisito que entrega el change está especificado, tiene un escenario que
puede fallar, está enlazado a un test que lo nombra, y que los tests pasan. Al
final de esta guía tu proyecto ejecuta el gate en tu máquina y en CI, como un
check sin el que un pull request no puede hacer merge, y sabes leer cualquier
fallo que reporte.

**Necesitas:** un proyecto donde se haya ejecutado `specgate init` o
`specgate adopt`, y git.

| Página | Qué haces ahí |
| --- | --- |
| [En tu máquina](local.md) | Ejecutar el gate antes de hacer push; solo lo que cambió; un hook pre-commit |
| [En CI](ci.md) | El job que escribe `ci init`, para GitHub, GitLab, Azure o Jenkins, convertido en check obligatorio |
| [Adóptalo sin un build en rojo](baselines.md) | Los hallazgos de hoy registrados como deuda, para que solo fallen los nuevos |
| [Lee un fallo](failures.md) | Cada código con el que falla el gate, qué significa y qué hacer |

## Qué ejecuta

`specgate check` ejecuta las etapas en este orden. Una etapa que falla detiene
las siguientes, salvo el check de arquitectura y los tests, que se ejecutan
en paralelo.

<!-- specgate:diagram gate-stages -->

| Etapa | Qué demuestra | Falla con |
| --- | --- | --- |
| Ids | Ningún id de requisito de aquí significa otra cosa en la rama base; con `--base`, lo que la rama cambia en los controles se nombra para quien revisa | `id_taken_on_base`, `controls_changed_on_branch` |
| Changes | El delta de cada change abierto valida; lo que aprobó una persona —requisitos, diseño, tests de aceptación sellados— sigue como se aprobó | `check_change_invalid`, `approved_requirement_changed`, `file_outside_design`, `acceptance_not_sealed` |
| Especificación | `validate --strict`: specs, escenarios, enlaces, cobertura de la matriz | `check_validate_failed` |
| Arquitectura | Tu `arch_cmd` (ArchUnit, dependency-cruiser…) pasa | `check_arch_failed` |
| Tests | Tu `test_cmd` pasa | `check_tests_failed` |
| Escenarios | Con `bdd: required` en la política: los escenarios de cada requisito entregado pasan con `bdd_cmd`. `--no-scenarios` los omite | `check_scenarios_failed` |
| Aceptación | Donde un change abierto selló tests de aceptación: pasan con `acceptance_cmd` | `acceptance_red`, `acceptance_no_command` |
| Calidad | Los `checks:` de `harness.config.yaml`: cobertura, mutación, secretos… | `check_quality_failed` |

Una etapa sin nada que ejecutar se informa, no falla: sin `test_cmd` el gate
comprueba solo la especificación y lo dice, y sin rama base los ids no se
comparan.

```text
$ specgate check
  ◆ specgate · check   shop

  ·  Ids            not compared with a base — no base branch (pass --base <branch>)
  ✔  Specification   validate --strict
  ✔  Tests           npm test
  ·  Architecture    not checked — specgate config set arch_cmd "<command>"

  ✔  Gate passed — the specification and `npm test`
```

Códigos de salida: `0` el gate pasó, `1` falló, `2` el comando se usó mal. Un
pipeline no necesita nada más.

## Qué comando

| Comando | Úsalo para |
| --- | --- |
| `specgate check` | El gate. Antes de hacer push, y en CI. |
| `specgate check --ci` | Lo mismo, en CI: un check de calidad que no puede ejecutarse falla en vez de omitirse, y también se ejecutan los checks de la etapa `ci`. |
| `specgate validate . --strict` | Solo la especificación, sin ejecutar tus tests: es lo que ejecutan la imagen Docker y los plugins de Maven y Gradle. |
| `specgate quality run` | Solo los checks de calidad, por etapa. |
| `specgate check --last` | El último resultado, sin ejecutar nada. |

## Qué debe un requisito, según su estado

El gate no le pide todo a un requisito de una vez:

- **Draft** no debe nada todavía. El gate de un proyecto nuevo está en verde
  desde el primer día, y un escenario aún puede contener `<placeholders>`.
- **Approved** y los siguientes deben un escenario que pueda fallar: pasos
  reales, con `Given`, `When` y `Then` en mayúscula inicial.
- **Implemented**, **Verified** y **Released** deben un test que nombre el
  requisito o su escenario, una obligación real en `spec.md` en lugar de la
  frase que escribió Specgate, y archivos que existan para cada ruta que nombra
  la matriz.

El detalle de cada regla: [Qué comprueba `validate`](../validating.md#what-validate-checks).

## Siguiente

- [En tu máquina](local.md)
