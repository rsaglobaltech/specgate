<!-- translation-of: 596bc0687cca -->
# Qué promete la 1.0

Desde la 1.0, Specgate sigue el versionado semántico, y el build lo hace
cumplir: un cambio que rompería un proyecto, un script o una herramienta
construida sobre la CLI espera a la siguiente versión mayor, y se anuncia antes
de irse.

## Qué se promete

Dentro de una versión mayor (1.x), nada de esto desaparece ni cambia de significado:

| Superficie | Ejemplos |
| --- | --- |
| Comandos y subcomandos | `specgate apply`, `specgate change show` |
| Sus flags | `apply --test-cmd`, `status --json` |
| Códigos de diagnóstico | `apply_no_test`, `harness_config_invalid` |
| Las claves de las respuestas JSON que lee una herramienta, y sus tipos | `requirements[].id` y `next.argv` de `status --json` |
| Herramientas MCP | `specgate_status` |
| La API de la biblioteca | `@rsaglobaltech/specgate/api`: `status()`, `API_VERSION` |
| Claves de configuración | `lanes:` de `harness.config.yaml`, claves de `config set` |
| Códigos de salida | 0 hecho, 1 falló, 2 error de uso, 3 falta un requisito previo, 130 cancelado |

Una versión menor (1.1, 1.2…) puede añadir a todo esto: un comando nuevo, un
flag nuevo, una clave nueva en una respuesta. Una herramienta que lee el JSON
debe ignorar las claves que no conoce. Una versión de parche (1.0.1) corrige
comportamiento y no añade nada.

Qué no se promete: el texto de los mensajes y de `--help` (lee `code`, no
`message`), la disposición de la salida para personas y cualquier cosa bajo
`docs/` que no sea un formato que Specgate lee.

## Cómo se mantiene

`contract/surface.json` lista la superficie pública tal como la dejó la última
versión —cada comando, flag, código, herramienta MCP, export de la API, clave de
configuración y clave JSON con su tipo—, leída de la CLI y del código, no escrita
a mano. Cada pull request ejecuta `npm run contract:check`, que construye la
misma lista a partir del código que se va a hacer merge y compara las dos (REQ-568):

- un elemento que desaparece, o una clave JSON cuyo tipo cambia, hace fallar el build;
- un elemento que aparece se lista, y la versión que lo publica es al menos
  menor (`contract:check --release <version>`).

## Proyectos de cada versión

Un proyecto tal como lo escribió cada versión —hoy 0.35.0 y 1.0.0, después cada
versión siguiente— se guarda en `tests/compat/<version>/`. Cada build lee cada
uno: `validate`, `status`, `config list`, `change validate` y, para un proyecto
anterior a la 1.0, `migrate 1.0` y `validate --strict` después (REQ-570).

## Cuando se publica una versión

Antes de que el tag publique nada, `contract:check --release <version>` comprueba
la versión contra la superficie: un parche que le añade algo, o una eliminación
fuera de una versión mayor, detiene la publicación (REQ-571). Después, el
paquete publicado se instala desde npm con su dist-tag y se usa: `--version`,
`init`, `status` (REQ-572).

## Comportamiento que cambia en la 1.6

Ningún comando, flag, código ni clave desaparece en la 1.6, pero dos comandos
ahora rechazan lo que antes hacían. Un script o un agente que dependía de
cualquiera de los dos se rompe:

| Comando | Hasta la 1.5 | Desde la 1.6 | Qué hacer |
| --- | --- | --- | --- |
| `specgate change approve <id>` | Aprobaba el change desde cualquier sitio | Sin terminal —la herramienta de un agente, un paso de CI, un script— falla con `approve_needs_person` y no registra nada (REQ-748) | Una persona lo ejecuta en una terminal, o aprueba en Review del studio |
| `specgate apply <REQ>` | Entregaba un requisito fuera cual fuera la aprobación de su change | Rechaza un requisito cuyo change abierto nadie aprobó, con `change_not_approved` (REQ-745) | Aprueba antes el change: `specgate change approve <id>`. Un proyecto que nunca quiere aprobaciones pone `approvals: { required: never }` en `harness.config.yaml` |

Cada código, con su corrección: [Leer un fallo del gate](gate/failures.md#rechazado-antes-del-gate).

## Deprecación y después eliminación

Algo se elimina en dos pasos, nunca en uno (REQ-569):

1. Una versión menor lo lista en `contract/deprecations.json` —el elemento, la
   versión que lo deprecó y qué usar en su lugar— y el CHANGELOG lo dice.
   Sigue funcionando.
2. La siguiente versión mayor lo elimina. Eliminar un elemento que nunca se
   deprecó hace fallar el build, sea mayor o no.

## Actualizar a través de una versión mayor

`specgate migrate <version>` hace lo que se puede hacer por ti y lista lo que
no, archivo por archivo. → [Migrar a la 1.0](migrating-to-1.0.md)

## Siguiente

- [Migrar a la 1.0](migrating-to-1.0.md) — desde la 0.35 o anterior
- [El contrato del agente](specs/agent-contract.md) — las reglas JSON y los códigos completos
