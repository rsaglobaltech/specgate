<!-- translation-of: 35365f7e5dfa -->
<!-- specgate:allow-placeholders — this guide quotes the {{VAR}} template syntax. -->

# Resolución de problemas

Encuentra tu problema por lo que ves, o por el código entre corchetes al final
de una línea de error, como `[matrix_stale]`. Cada error que imprime Specgate ya
dice cómo corregirlo; esta página añade la causa y el contexto.

Primero, ejecuta el diagnóstico integrado. Comprueba el entorno, la estructura
del proyecto y la trazabilidad en ambas direcciones, e imprime una corrección
para cada hallazgo:

```bash
specgate doctor
```

## Índice por código

| Códigos | Sección |
| --- | --- |
| `tests_not_configured`, `check_tests_failed`, `check_arch_failed`, `check_validate_failed`, `check_change_invalid`, `scenario_steps_unwritten`, `scenario_placeholder_step`, `scenario_not_covered`, `[TDD-1]`, `declared_artifact_missing`, `requirement_template_obligation`, `id_taken_on_base`, `matrix_stale` | [El gate](#el-gate) |
| `apply_no_test`, `done_validate_failed`, `done_tests_failed`, `done_needs_clarification`, `archive_requirements_pending`, `archive_draft_not_ready` | [Apply y archive](#apply-y-archive) |
| `D1`–`D12`, `draft_no_brief`, `draft_module_not_in_brief`, `draft_agent_failed`, `draft_agent_needs_git`, `draft_brief_text_lost`, `draft_brief_body_changed` | [Redacción](#redaccion) |
| `T1`–`T9`, `ticket_*`, `pr_failed`, `change_overlap`, `change_id_clash`, `change_base_moved` | [Tickets](#tickets) |
| `requirement_scenario_unrunnable`, `agent_rewrote_gate_command` | [Harness](#harness) |
| `alm_config_unread_key` | [Tickets](#tickets) |

## Instalación

| Síntoma | Causa | Corrección |
| --- | --- | --- |
| `npx specgate` ejecuta otra cosa, o pide instalar | El paquete no está instalado en este proyecto | `npm install --save-dev @rsaglobaltech/specgate`, y después `npx specgate …` |
| Quieres probarlo sin instalar | — | `npx @rsaglobaltech/specgate@latest …` |
| Un error de sintaxis o un aviso de engine al arrancar | Node.js anterior a 22 | Instala Node.js 22 o posterior |
| El primer `npx @rsaglobaltech/specgate@latest` es lento | npm descarga el paquete una vez | Las siguientes ejecuciones usan la caché; CI fija una versión (ver [CI](#ci)) |

### Actualizar un proyecto desde la 0.18 o anterior

Desde la 0.19 todo se llama `specgate`: los marcadores de tus specs
(`<!-- specgate:trace … -->`), la carpeta `.specgate/` y las variables
`SPECGATE_*`. Un proyecto que sigue en el antiguo formato `csda:` falla
`validate` con `old_format`, y el mensaje nombra el comando que lo migra, una
vez ([ADR-0032](specs/adr/0032-one-name-everywhere.md)). Tras cualquier
actualización, ejecuta `specgate update`: refresca el contrato del agente en
`AGENTS.md` y los comandos del agente a la versión instalada.

## El gate

`specgate check` es el gate: valida la especificación, ejecuta tu check de
arquitectura cuando hay uno fijado y después ejecuta tus tests. Los fallos más
comunes en un primer pull request se explican con ejemplos en
[El primer PR de tu equipo](first-pr.md).

| Código o síntoma | Causa | Corrección |
| --- | --- | --- |
| "checked the specification, not the code" (`tests_not_configured`) | No hay comando de tests configurado, así que no se ejecutó ningún test | `specgate config set test_cmd "npm test"` (cualquier comando que use tu proyecto) |
| `check_tests_failed` | Tus tests fallaron | Lee la salida de los tests encima de la línea y corrige el código o el test |
| `check_arch_failed` | Falló el check de arquitectura (`arch_cmd`) | Mueve el código a la capa que nombra la regla; no cambies la regla |
| `check_validate_failed` | La especificación tiene errores | Corrige cada hallazgo listado encima |
| `check_change_invalid`, `scenario_steps_unwritten` | Un change abierto tiene un escenario que aún contiene `<placeholders>` | Escribe los pasos Given/When/Then reales; `specgate change validate <id>` los lista todos |
| `scenario_placeholder_step` | Un archivo feature de un requisito que se está entregando aún tiene placeholders | Escribe los pasos reales |
| `scenario_not_covered` | Ningún test nombra el escenario | Nómbralo en el test que lo demuestra (`SCN-007a`) |
| `[TDD-1]` | Un requisito que ya no es Draft sin un test que lo nombre | Nombra `REQ-007` en su test, o devuélvelo a Draft |
| `declared_artifact_missing` | Una ruta escrita en el comentario de trazabilidad de un requisito ya no existe | Restaura el archivo o corrige la ruta |
| `requirement_template_obligation` | Un requisito dice estar entregado pero aún tiene la frase de plantilla | Escribe la obligación real |
| `id_taken_on_base` | Otra rama hizo merge del mismo id de requisito con otro título | Renumera el tuyo al id que sugiere el mensaje |
| `matrix_stale` (solo CI) | No se hizo commit de `docs/specs/traceability.md` tras un cambio | Ejecuta `specgate check` en local y haz commit de la matriz |
| Un conflicto de merge en `traceability.md` | Una matriz mantenida a mano; una generada se fusiona sola | Consulta [Ramas en paralelo y la matriz](harness.md) |

La **matriz de trazabilidad** (`docs/specs/traceability.md`) se genera a partir
de los specs, los archivos feature y los tests. Nunca añadas ni edites sus filas
a mano; corrige la fuente y deja que `specgate check` la regenere.

## Apply y archive

| Código | Causa | Corrección |
| --- | --- | --- |
| `apply_no_test` | Ningún test nombra aún el requisito | Escribe primero el test y nombra `REQ-007` en él |
| `done_validate_failed` | `apply` ejecutó el gate y falló; no se escribió nada | Corrige lo que se lista encima y vuelve a ejecutar `apply` |
| `done_tests_failed` | Los tests fallaron durante `apply` | Corrígelos; `apply` no marca nada hasta que pasan |
| `done_needs_clarification` | El requisito espera la respuesta a una pregunta abierta | Respóndela en `questions.md` y quita `Needs Clarification` de su trace |
| `archive_requirements_pending` | Un requisito del change no está Implemented | Ejecuta el `specgate apply REQ-…` que nombra; `--force` no se salta esto |
| `archive_draft_not_ready` | Un change abierto desde un brief o un ticket tiene hallazgos abiertos de la lista de comprobación | Ejecuta el comando `propose` que nombra y corrige los hallazgos |

`apply` nunca hace commit. Haz commit después de cada requisito, y después de `archive`.

## Redacción

Un borrador es un change abierto desde un brief o un ticket. Las **reglas D**
son la lista de comprobación de redacción que se ejecuta sobre él, de D1 a D12;
cada una se explica en [Desde el brief de un cliente](from-a-brief.md#3-comprueba-el-borrador).

| Código o síntoma | Causa | Corrección |
| --- | --- | --- |
| `draft_no_brief` | No hay `docs/brief.md` | `specgate propose --from-brief --new-brief` escribe uno para rellenar |
| `draft_module_not_in_brief` | El módulo no está listado en `modules:` del brief | Añádelo ahí |
| D6: un valor no está en el brief | El borrador usa un número o un nombre que su fuente no dice | Pregunta al cliente, o regístralo en `assumptions.md` |
| D7: una pregunta abierta | Una pregunta que ningún requisito espera | Haz que el requisito que bloquea la espere, o respóndela |
| `draft_agent_failed` | El comando del agente no se ejecutó o falló | Ejecuta antes el comando por separado; o pega el prompt en tu agente |
| Studio: una respuesta dijo "Saved" y no cambió nada (0.27 y anteriores) | `questions.md` no tenía columna `Answer` | Actualiza a 0.28.1, o añade las columnas `Answer` y `Status` a la tabla |
| Studio: **Approve the draft** nunca se activa | Hay una pregunta abierta, o respondida mientras su requisito aún espera | 0.28.1 lista cada bloqueo con su acción; en 0.27, quita `status="Needs Clarification"` y escribe la respuesta en el requisito |
| `draft_agent_needs_git` | `--agent` solo funciona en un repositorio git | `git init`, o pega el prompt en tu agente |
| "Undone — the agent wrote outside the draft" | El agente cambió archivos fuera del change | Nada que hacer: Specgate los revirtió |
| `draft_brief_text_lost`, `draft_brief_body_changed` | El agente cambió el propio texto del brief | Nada que hacer: Specgate lo restauró; inténtalo de nuevo, o escríbelo tú |

## Tickets

Los problemas de tickets, desde un token de Jira con alcance limitado hasta un
ticket que nunca avanza en el tablero, están en la tabla de
[Desde un ticket de Jira](from-a-ticket.md): `T1`–`T9`,
`ticket_epic`, `ticket_changed`, `ticket_copy_edited`, `ticket_key_missing`,
`ticket_bad_key`, `ticket_no_capability` y los errores de `specgate alm pr`
(`pr_failed`). Las **reglas T** son la Definition of Ready del ticket.

`change_overlap` significa que dos changes abiertos reescriben el mismo
requisito: uno en tu rama, el otro en la misma rama o en otra que aún no tiene
merge (`check` lee cada rama local y de seguimiento remoto). Fusionados tal
cual, la segunda reescritura sustituiría a la primera, con o sin conflicto de
git. Acuerda cuál va primero, haz su merge, tráelo a la otra rama y redacta de
nuevo el segundo change sobre el requisito tal como quedó. Ejecuta antes
`git fetch`, para que las ramas remotas con las que comparas estén al día.

`change_id_clash` significa que dos changes abiertos en ramas distintas añaden
un requisito con el mismo id: ambos se abrieron antes de que ningún clon
descargara la rama del otro. `propose --from-ticket` hace fetch de `origin`
antes de reservar ids, así que esto requiere dos tickets abiertos con segundos
de diferencia. Renumera el que tenga la rama sin merge, en su delta y en los
tests que lo nombran.

`change_base_moved` significa que un requisito que tu change modifica o elimina
ha cambiado desde que se escribió tu delta: normalmente, el otro ticket de un
`change_overlap` hizo merge primero. Archivar tu delta tal cual sustituiría el
requisito por tu reescritura del texto antiguo, y la regla del otro ticket se
perdería sin conflicto, así que `archive` se niega. Trae la base a tu rama,
reescribe el requisito en tu delta sobre el texto tal como se lee ahora,
conservando lo que añadió el otro change, y después ejecuta
`specgate change validate <change> --rebased` para registrar el nuevo texto. El
primer `check` o `change validate` que ve un change registra lo que reescribe,
en `based_on` de su `change.yaml`.

Un conflicto de git en `docs/specs/capabilities/<name>/spec.md` con marcadores
alrededor de requisitos enteros significa que ambas ramas reescribieron ese
requisito. Escríbelo como debe quedar con ambos cambios, borra los marcadores y
ejecuta `specgate check`. Si el conflicto cubre todo el archivo, este clon no ha
registrado el driver de merge: `specgate doctor` lo dice y
`specgate harness init` lo registra.

`alm_config_unread_key` significa una clave de `alm.config.yaml` que tu
proveedor no lee. El mensaje nombra el proveedor que la leería; consulta
[todas las claves](alm.md).

## Harness

El **harness** (`specgate harness run`) construye requisitos con un agente, sin
supervisión, un worktree de git por requisito. Consulta [El harness](harness.md).

| Código o síntoma | Causa | Corrección |
| --- | --- | --- |
| `requirement_scenario_unrunnable` | El escenario del requisito aún no puede ejecutarse | Escribe antes su archivo feature y sus pasos |
| El intento terminó en `write-scope` | El agente editó la especificación con la que se le juzga | Nada que hacer: el intento se rechaza; corrige el prompt si se repite |
| El intento terminó en `no-op` | El agente no escribió ningún archivo | Revisa los permisos de escritura del agente y su comando |
| `agent_rewrote_gate_command` | El agente cambió el script que ejecuta tu comando de tests | Rechazado; el comando del gate es parte del contrato |
| El primer intento se gasta instalando dependencias | Un worktree nuevo no tiene `node_modules` | Deja el `--setup-cmd` por defecto, o fija tu comando de instalación |
| Ya existe una rama `harness/REQ-…` | Una ejecución anterior | `--resume` para continuarla, o `--force` para empezar de nuevo |
| Falló `quality check: <name>` | Un [check de calidad](quality.md) encontró algo nuevo | Lee sus hallazgos; toma la baseline si es deuda antigua |
| `Docker is not running here` | Un check de calidad se ejecuta en Docker, o los tests usan Testcontainers; `harness run` y Build del studio se detienen antes de cualquier agente | Arranca Docker Desktop, o el daemon |
| `the tests need Docker, which they could not reach` | Docker se detuvo mientras se ejecutaban los tests | Arranca Docker Desktop y vuelve a ejecutarlo: no se pregunta al agente |
| Build del studio dice que hay archivos sin commit | Trabajo en curso fuera de la especificación | Haz commit o stash; el studio solo hace commit de la especificación |
| El studio dice que la carpeta tiene archivos | Su paso de proyecto nuevo solo usa una carpeta vacía | `specgate init` adopta la carpeta, conservando sus archivos |

### Cuando otro intento no puede ayudar

El harness se detiene en el primer fallo que ningún reintento puede corregir:
el agente sin cuota o con límite de peticiones; un gate que falla solo en
archivos que el agente no puede editar (una persona corrige la especificación;
"Nothing proves" sí se reintenta, porque lo corrige un test); un requisito que
espera una respuesta. Al llegar a `--timeout` (1200 segundos por defecto) se
detienen el agente y todo lo que arrancó. `specgate harness init` pone el build
en el gate cuando hay uno: tests que pasan con un build roto no cuentan como
entregados.

## CI

| Síntoma | Causa | Corrección |
| --- | --- | --- |
| Se hizo merge de un pull request con el gate en rojo | El job de CI no es un check obligatorio | Protege la rama base: [exige el check](first-pr.md) |
| CI cambió de comportamiento tras una versión de Specgate | No debería: `specgate ci init` fija la versión | Tras actualizar el paquete, ejecuta `specgate ci init --force` para mover la versión fijada |
| CI "no ejecuta tests" | Aún no hay comando de tests configurado | `specgate config set test_cmd "<command>"` — el gate lo lee, sin cambiar el archivo de CI |
| `matrix_stale` solo en CI | No se hizo commit de la matriz regenerada | Ejecuta `specgate check` en local y haz commit de `traceability.md` |

## Agentes

| Síntoma | Causa | Corrección |
| --- | --- | --- |
| El agente no conoce los comandos `/specgate:*` | No se instalaron para esa herramienta | `specgate agents init --tool <name>` |
| `agents init` dejó un archivo como estaba | Los archivos existentes nunca se sobrescriben | `specgate agents init --force`, tras comprobar qué perderías |
| El agente se detiene: "the stack is TBD and I may not choose it" | `adopt` no encontró manifiesto de build, así que `AGENTS.md` deja el stack sin decidir | `specgate config set stack "<yours>"` y `config set testing "<yours>"`; para una aplicación nueva, `specgate init --forja` |
| El agente edita el spec o un test para llegar a verde | Trata el contrato como código | Remítelo a `AGENTS.md`; el harness rechaza ese intento de todos modos |
| Build del studio: "The assistant is not configured" | No hay `agent` en `harness.config.yaml` | Elige uno en Build (0.28.1), o `specgate config set agent "claude -p < {prompt_file}"` |
| El agente no puede leer el prompt en Windows | Una carpeta temporal con un espacio (0.27) | 0.28.1 entrecomilla esa ruta; o fija `TEMP` a una carpeta sin espacios |

Consulta [Agentes](agents.md) y [Elegir y conectar tu agente](agent-setup.md).

## Packs de dominio

| Síntoma | Causa | Corrección |
| --- | --- | --- |
| `expand` deja `{{VARS}}` en los archivos generados | No se pasó un `--var` obligatorio | Vuelve a ejecutarlo con la variable; consulta `variables.required` en `pack.yaml` |
| `pack lint` rechaza un pack que antes funcionaba | Un esquema más nuevo exige más campos | Lee el error de la última versión: `npx @rsaglobaltech/specgate@latest pack lint …` |

Consulta [Packs de dominio](domain-packs.md).

## Sigues atascado

Abre una incidencia con la salida de `specgate doctor`, el comando que falla, su
salida completa y tu versión de Specgate (`specgate --version`).

## Siguiente

- [Qué comprueba el gate](validating.md)
- [Preguntas frecuentes](faq.md)
