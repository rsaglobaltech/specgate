<!-- translation-of: b3c3b60b6aaa -->
# Deriva y contratos de API

Dos checks que impiden que el código se aleje de la especificación entre
pull requests: un comportamiento que cambió sin un requisito, y un
requisito que nombra una operación de API que no existe.

## Comportamiento que cambió sin especificación

`specgate check` lista cada commit desde la base que cambia código de producción,
no nombra ningún requisito (`REQ-NNN`) en su mensaje y no cambia ningún test que
nombre uno: el aviso `spec_drift`, con el commit y sus archivos (REQ-333). Los tests,
specs, features, docs y la configuración de build no son código de producción; los
commits del harness nombran su requisito, así que nunca derivan.
`specgate drift [--base <branch>] [--json]` imprime lo mismo para CI. Con
`drift: gate` en harness.config.yaml hace fallar a ambos (REQ-334); `drift: off` deja
de mirar.

## Un requisito que apunta a una operación de API

Un requisito puede nombrar la operación que especifica en su comentario de traza:
`api=openapi.yaml#/paths/~1positions/post` (un JSON pointer),
`api=openapi.yaml#reportPosition` o un `api=reportPosition` sin más. `validate`
lee OpenAPI y AsyncAPI, en YAML o JSON, y falla con `api_operation_missing`
o `api_contract_missing` cuando no existe (REQ-335).
`specgate contract check` lista, por contrato, las operaciones que ningún requisito
cita y las referencias que no se resuelven (REQ-336).

## Siguiente

- [Validar](validating.md) — el gate, en local y en CI
- [Workspace](workspace.md) — varios repositorios, y los contratos entre ellos
