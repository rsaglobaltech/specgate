<!-- translation-of: cbab84bd27cd -->
# Referencia de comandos

Cada comando de Specgate, una línea cada uno, agrupados por la tarea que estás
haciendo. Cada fila enlaza a la página que lo explica por completo.

`specgate --help` lista el ciclo diario. `specgate --help --all` lista todos los
comandos, y `specgate <command> --help` muestra las opciones de un comando. Para
que la lista completa sea la predeterminada, ejecuta `specgate config set profile full`.
El paquete también instala `sgate`, un alias corto de `specgate`.

En estas tablas, un **change** es una carpeta en `docs/specs/changes/<id>/` que
propone requisitos nuevos o cambiados; el **gate** es `specgate check`. Consulta
[el vocabulario](concepts.md#vocabulario) para los demás términos.

## El ciclo

| Comando | Qué hace | Detalles |
| --- | --- | --- |
| `specgate init` | Adopta un repositorio que tiene código, o crea el esqueleto de un proyecto nuevo. | [Primeros pasos](getting-started.md) |
| `specgate propose <change-id>` | Abre un change: una propuesta, un delta y un rango reservado de ids REQ. | [Cambiar un requisito ya entregado](reviewing-changes.md) |
| `specgate apply [<REQ>]` | Entrega un requisito: se rechaza hasta que un test lo nombra y el gate pasa. | [Escribir specs](writing-specs.md) |
| `specgate status` | Qué queda, y el único comando que ejecutar a continuación. | [Escribir specs](writing-specs.md) |
| `specgate archive <change-id>` | Fusiona un change en los specs cuando todos sus requisitos están Implemented. | [Cambiar un requisito ya entregado](reviewing-changes.md) |
| `specgate check` | El gate: `validate --strict`, tu check de arquitectura y después tus tests. | [Validar](validating.md) |

`apply` no hace commit; haz commit después. `archive` se ejecuta en tu rama,
antes del pull request, para que el spec y el código se revisen juntos.

## De dónde viene el trabajo

| Comando | Qué hace | Detalles |
| --- | --- | --- |
| `specgate propose <change-id>` | Un comportamiento: escribes el delta tú mismo. | [Cambiar un requisito ya entregado](reviewing-changes.md) |
| `specgate propose --from-brief` | Lista los módulos de `docs/brief.md` y el siguiente que redactar. | [Desde un brief](from-a-brief.md) |
| `specgate propose --from-brief --new-brief` | Escribe un `docs/brief.md` para que lo rellenes. Nunca sobrescribe uno. | [Escribir el brief](start/write-the-brief.md) |
| `specgate propose --from-brief --check` | Ejecuta las reglas del brief (B1–B15) sobre el brief. No escribe nada. | [Escribir el brief](start/write-the-brief.md#paso-9-compruebalo) |
| `specgate propose --from-brief --agent "<cmd>"` | Tu agente propone los campos del brief y después una sección por módulo. | [Desde un brief](from-a-brief.md) |
| `specgate propose --from-brief --form` | El brief como formulario, cada campo con su línea; `--form <file>` lo vuelve a escribir. | [Desde un brief](from-a-brief.md) |
| `specgate propose --from-brief --guide setup` | Imprime la guía que sigue un agente para proponer el front matter; `cards`, las secciones por módulo. No escribe nada. | [Desde un brief](from-a-brief.md) |
| `specgate propose --from-brief <module>` | Abre el change borrador de ese módulo, o lo comprueba si ya existe. | [Desde un brief](from-a-brief.md#2-redacta-un-modulo) |
| `specgate propose --from-ticket <KEY>` | Abre un change a partir de un ticket de Jira, en una nueva rama `feature/<KEY>-<slug>`. | [Desde un ticket de Jira](from-a-ticket.md) |
| `specgate propose --from-ticket <KEY> --check` | La Definition of Ready del ticket (reglas T1–T9). No escribe nada. | [Desde un ticket de Jira](from-a-ticket.md) |
| `specgate alm pr <change-id>` | Sube la rama del ticket y abre o actualiza su único pull request en GitHub. | [Desde un ticket de Jira](from-a-ticket.md) |

Más opciones de `--from-ticket`: `--agent "<cmd>"` hace que tu agente redacte el
change, `--capability <name>` nombra la capacidad cuando la épica del ticket no
está mapeada, `--no-branch` usa la rama en la que estás (con commit y push ahí
cuando su nombre lleva la clave) y `--no-push` la crea sin subirla. Un ticket también puede ser un archivo: `--from-ticket KAN-13.json`.
Para `--from-brief <module>`, `--agent "<cmd>"` pasa el borrador a tu agente y
`--reserve <n>` fija cuántos ids REQ reserva (10 por defecto). En un borrador ya
abierto, amplía el rango hasta n, siempre que ningún change posterior haya
reservado los ids siguientes: abre los módulos de uno en uno para que sea posible.

## Empezar un proyecto

| Comando | Qué hace | Detalles |
| --- | --- | --- |
| `specgate init --new` | Crea el esqueleto de un proyecto nuevo incluso donde ya hay código. | [Primeros pasos](getting-started.md) |
| `specgate init --forja <name>` | Genera una aplicación completa con forja, conectada a Specgate. | [forja](forja/specgate.md) |
| `specgate init --from-pack <repo>@<tag> --pack <id>` | Crea el esqueleto e instala un pack de dominio fijado en un solo paso. | [Packs de dominio](domain-packs.md) |
| `specgate init --multi-stack <a,b>` | Un proyecto hermano por stack, compartiendo un `spec.md` y `features/`. | `specgate init --help` |
| `specgate adopt` | Instala Specgate en un repositorio existente. Nunca sobrescribe un archivo. | [Primeros pasos](getting-started.md) |
| `specgate onboard` | Propone las capacidades que implica la estructura de un repositorio existente. No escribe nada. | `specgate onboard --help` |
| `specgate onboard --tour` | Ejecuta el ciclo completo sobre una copia temporal de tu repositorio, narrado. | `specgate onboard --help` |
| `specgate reverse --modules` | Lista los módulos de un sistema existente, con su stack y número de archivos. Sin agente. | [Especificar un sistema que ya funciona](reverse.md) |
| `specgate reverse <module>` | Tu agente redacta un módulo como change: requisitos Draft que citan `source=`. | [Especificar un sistema que ya funciona](reverse.md) |
| `specgate add usecase <module/Name>` | En un proyecto forja: la clase, su test y su conexión (también `entity`, `port`). | `specgate add --help` |

**forja no está en el registro de npm.** `init --forja` ejecuta
`npx @rsaglobaltech/forja@1` salvo que la variable de entorno
`SPECGATE_FORJA_CMD` nombre otro comando. Instala forja desde el tarball de su
release de GitHub y después apunta Specgate a él:

```bash
npm install -g https://github.com/rsaglobaltech/forja/releases/download/v1.0.0/rsaglobaltech-forja-1.0.0.tgz
SPECGATE_FORJA_CMD=forja specgate init --forja shop
```

**`init --from-pack` tiene un problema conocido:** falla con un requisito con dos
escenarios. Hasta que se corrija, ejecuta `specgate init` y después `specgate specops add`.

## Requisitos

| Comando | Qué hace | Detalles |
| --- | --- | --- |
| `specgate new "<title>"` | Añade un requisito directamente a `spec.md`, sin change. Un atajo para proyectos pequeños. | [Escribir specs](writing-specs.md) |
| `specgate req add "<title>"` | Añade un requisito Draft y su fila de la matriz. | `specgate req --help` |
| `specgate req link <REQ> --test <path>` | Registra un enlace (`--feature`, `--test`, `--code`, …) para un requisito. | `specgate req --help` |
| `specgate req rm <REQ>` | Elimina la fila y la prosa de un requisito. `--force` si ya no es Draft. | [Escribir specs](writing-specs.md) |
| `specgate req list` | Lista los requisitos y su estado. | `specgate req --help` |
| `specgate plan` | Requisitos que aún necesitan un test, código o un cambio de estado. | [Escribir specs](writing-specs.md) |
| `specgate explore ["<question>"]` | Una instantánea del proyecto para pensar, antes de que exista un change. No escribe nada. | `specgate explore --help` |
| `specgate questions` | Todo lo que espera una respuesta: preguntas abiertas, lo que bloquean, requisitos en espera. | `specgate questions --help` |
| `specgate answer <Q> "<answer>"` | Escribe la respuesta y una suposición que revisar; `--reviewed` cuando el spec la refleja. | `specgate answer --help` |
| `specgate ask <REQ> "<question>"` | Pregunta en lugar de adivinar: el requisito espera. El agente del harness también puede ejecutarlo. | `specgate ask --help` |
| `specgate brief add <module> "<text>"` | Un requisito nuevo para un módulo que cubre el brief, archivado o no, citando el texto. | `specgate brief add --help` |
| `specgate matrix` | Regenera la matriz de trazabilidad a partir de `spec.md`, las etiquetas y los tests. | [Una matriz que nadie edita](writing-specs.md) |
| `specgate fix` | Aplica las reparaciones que sugiere `validate`. `--dry-run` las previsualiza. | `specgate fix --help` |
| `specgate validate . --strict` | Comprueba specs, escenarios, enlaces y cobertura, sin ejecutar tests. | [Validar](validating.md) |

## Changes

| Comando | Qué hace | Detalles |
| --- | --- | --- |
| `specgate change list` | Los changes abiertos y el progreso de sus tareas. | [Cambiar un requisito ya entregado](reviewing-changes.md) |
| `specgate change show <id>` | La propuesta de un change, sus deltas y lo que tocan. | [Cambiar un requisito ya entregado](reviewing-changes.md) |
| `specgate change status [<id>]` | Qué archivo del change escribir a continuación. | [Cambiar un requisito ya entregado](reviewing-changes.md) |
| `specgate change instructions <artifact>` | La plantilla y las reglas de un archivo de un change, para ti o para un agente. | [Agentes](agents.md#por-que-los-archivos-generados-son-finos) |
| `specgate change author <id>` | Hace que un agente escriba un archivo de un change, confinado a la carpeta del change. | [Cambiar un requisito ya entregado](reviewing-changes.md) |
| `specgate change validate [<id>]` | Comprueba los deltas. `specgate validate` también lo ejecuta. | [Cambiar un requisito ya entregado](reviewing-changes.md) |
| `specgate change new <id> --modify <REQ>` | Abre un change con el requisito copiado en un delta MODIFIED, Draft. | [Cambiar un requisito ya entregado](reviewing-changes.md) |
| `specgate change impact <REQ\|id>` | Spec, features, tests, archivos y requisitos que toca un cambio en él. | [Cambiar un requisito ya entregado](reviewing-changes.md) |
| `specgate change approve <id> [--layer <layer>]` | Una persona, en una terminal: aprueba las capas que le corresponden (`--layer discover\|design\|tasks`); `apply` y el harness lo esperan. | [Cambiar un requisito ya entregado](reviewing-changes.md) |
| `specgate change approve <id> --layer acceptance` | Sella por hash los tests de aceptación listados del change, una vez aprobado. | [Tests de aceptación sellados](reviewing-changes.md) |
| `specgate change note <id> "<text>"` | Pide al borrador un cambio con tus palabras, guardado en review.md (`--req REQ`). | [Cambiar un requisito ya entregado](reviewing-changes.md) |
| `specgate propose <id> --from-value-drift <REQ:id>` | Abre un change que actualiza un valor declarado con el que el código no coincide. | [Validar](validating.md) |

## Jira y otros trackers (ALM)

| Comando | Qué hace | Detalles |
| --- | --- | --- |
| `specgate alm sync` | Modo espejo: crea una incidencia por requisito y la cierra cuando el requisito está hecho. | [Jira y Azure Boards](alm.md) |
| `specgate alm pull` | Abre un change por cada incidencia con una etiqueta (`--label <name>`). | [Jira y Azure Boards](alm.md) |
| `specgate alm link <REQ> <issue>` | Asocia una incidencia existente a un requisito. | [Jira y Azure Boards](alm.md) |
| `specgate alm status` | La correspondencia entre requisitos e incidencias, sin acceso a la red. | [Jira y Azure Boards](alm.md) |
| `specgate alm pr <change-id>` | Un pull request por ticket en GitHub. `--no-push`, `--no-check`. | [Desde un ticket de Jira](from-a-ticket.md) |

Todos leen `alm.config.yaml` en la raíz del proyecto. Nombra variables de entorno
que contienen los tokens, nunca los tokens. Jira tiene dos modos —un ticket como
origen de un change, o un espejo de tus requisitos— y eliges uno por proyecto:
consulta [Desde un ticket de Jira](from-a-ticket.md) y
[Jira y Azure Boards](alm.md).

## Automatización y CI

| Comando | Qué hace | Detalles |
| --- | --- | --- |
| `specgate harness init` | Escribe `harness.config.yaml` y el prefijo del prompt. Deja el agente sin fijar. | [El harness](harness.md) |
| `specgate harness run` | Entrega requisitos pendientes con un agente; `--profile` elige cuál. | [El harness](harness.md) |
| `specgate harness prompt <REQ>` | Imprime el prompt que recibiría un agente. No ejecuta nada. | [Elegir tu agente](agent-setup.md) |
| `specgate harness report` | Tasa de primer intento, tiempo y coste por requisito entregado; `--capability`. | [Lo que ha costado el harness](harness-report.md) |
| `specgate harness doctor` | Qué agente recibe cada requisito, y si cada uno está instalado y responde. | [El harness](harness.md) |
| `specgate harness sandboxes [--prune]` | Cada sandbox que creó el harness y los hosts a los que puede llegar; `--prune` los restos. | [El harness](harness.md) |
| `specgate trust` | El nivel de confianza de cada módulo, su racha y sus bugs; `promote` sube uno. | `specgate trust --help` |
| `specgate map [<REQ>]` | Dónde vive cada requisito: caso de uso, ruta, feature, código, tests. | `specgate map --help` |
| `specgate reproduce <change>` | Abre un bug que hay que ver en rojo antes de corregirlo. | `specgate reproduce --help` |
| `specgate learn [promote <L>]` | Notas de revisión y fallos que se repiten, convertidos en una regla. | `specgate learn --help` |
| `specgate eval <skill>` / `--list` | Examina una skill con tareas fijas; `--list`: cada examen, sus textos, historial y ejecuciones. | `specgate eval --help` |
| `specgate harness events --from claude` | Convierte el stream de Claude Code en eventos para la vista en directo. | [El harness](harness.md) |
| `specgate harness stop --after-current` | Pide al harness en ejecución que se detenga tras el requisito en curso. | [Manejar el harness](harness-control.md) |
| `specgate studio` | La app visual, de una carpeta vacía al informe; `/live`: el harness. | `specgate studio --help` |
| `specgate ci init` | Escribe el job de CI para GitHub, GitLab, Azure o Jenkins. | [Validar](validating.md) |
| `specgate ci status` | Qué comprueba el gate de CI, y qué le falta. | [Validar](validating.md) |
| `specgate quality init [--level]` | Escribe los checks de basic o strict para el stack, todos en Docker. | `specgate quality --help` |
| `specgate quality list` | Los checks de calidad del gate: etapa, gate o aviso, cómo se ejecuta cada uno aquí. | `specgate quality --help` |
| `specgate quality doctor [--pull]` | Lo mismo, con lo que falta; `--pull` descarga ya las imágenes de Docker. | `specgate quality --help` |
| `specgate quality run [--stage]` | Ejecuta los checks de una etapa: attempt, end o ci. | `specgate quality --help` |
| `specgate quality baseline` | Registra los hallazgos SARIF de hoy como deuda: desde entonces solo fallan los nuevos. | `specgate quality --help` |
| `specgate migrate 1.0 [--dry-run]` | Pasa un proyecto 0.27 a 1.0: los changes abiertos a tres capas, y un informe. | [Migrar a la 1.0](migrating-to-1.0.md) |
| `specgate workspace init` | Nombra los repositorios de un producto en `specgate.workspace.yaml`. | [Workspace](workspace.md) |
| `specgate workspace status` | Los requisitos, la rama y el gate de cada repositorio, y cada historia. | [Workspace](workspace.md) |
| `specgate workspace check` | El gate de cada repositorio, los ids calificados y las dependencias entre repositorios. | [Workspace](workspace.md) |
| `specgate workspace draft [<story>]` | El brief del cliente, sus historias y una historia redactada por un agente. | [Workspace](workspace.md) |
| `specgate workspace propose <story>` | Una historia de negocio, y un change para ella en cada repositorio nombrado. | [Workspace](workspace.md) |
| `specgate workspace live` | El harness de cada repositorio y cada historia, en directo, con su coste. | [Workspace](workspace.md) |
| `specgate workspace harness run` | Un harness por repositorio con una parte de una historia, en orden de dependencias. | [Workspace](workspace.md) |
| `specgate drift [--base]` | Commits desde la base que cambian código y no nombran ningún requisito. | [Validar](validating.md) |
| `specgate contract check` | Contratos frente a requisitos: operaciones sin citar, operaciones que faltan. | [Validar](validating.md) |
| `specgate check --ci` | El gate en CI: también los checks `ci`, y un check que no puede ejecutarse falla. | [Validar](validating.md) |
| `specgate check --baseline` | Registra los hallazgos de hoy en `docs/specs/gate-baseline.json`: solo fallan los nuevos. | [Especificar un sistema que ya funciona](reverse.md) |
| `specgate check --last` | El último resultado del gate, su commit y sus etapas, sin ejecutar el gate. | [Validar](validating.md) |
| `specgate check --affected` | Solo los tests de lo que cambió desde la base; la suite completa cuando no puede saberlo. `--no-cache`. | [Un gate más rápido](fast-gate.md) |
| `specgate verify` | Para proyectos OpenSpec: falla mientras un escenario hecho no tenga un test que lo nombre. | [Ya en OpenSpec](openspec.md) |
| `specgate report` | Un panel de cobertura del spec como un único archivo HTML; `--format json`, `--capability`. | `specgate report --help` |
| `specgate doctor` | Diagnostica el proyecto y el entorno, con una corrección por hallazgo. | [Resolución de problemas](troubleshooting.md) |
| `specgate check --base <branch>` | También nombra lo que la rama cambia en los controles (`controls_changed_on_branch`, un aviso por defecto). | [Agentes](agents.md#los-guards) |
| `specgate compat run \| report \| check-release` | Para los mantenedores de Specgate: el examen de compatibilidad de cada herramienta de agente en cada nivel. | `specgate compat --help` |
| `specgate compat attack two-function` | Para los mantenedores de Specgate: reproduce el ataque grabado sobre un archivo de pasos sellado, sin modelo. | `specgate compat --help` |

## Agentes

| Comando | Qué hace | Detalles |
| --- | --- | --- |
| `specgate propose <id> --kind bug\|enhancement` | Registra el tipo del change; las notas de versión agrupan por él. | [Entregar](transition.md) |
| `specgate release-notes <from>..<to>` | Los changes archivados entre dos refs, por tipo, con sus requisitos. | [Entregar](transition.md) |
| `specgate acceptance <change>` | Una lista de comprobación por escenario; `--sign "<name>"` pasa de Implemented a Verified. | [Entregar](transition.md) |
| `specgate guide [--actor <name>]` | `docs/guide/<actor>.md`: los requisitos entregados de cada actor como pasos. | [Entregar](transition.md) |
| `specgate adr new "<title>"` | Registra una decisión de arquitectura: el siguiente ADR, Proposed, con fecha. | [Decisiones](decisions.md) |
| `specgate adr supersede <NNNN> "<title>"` | Un ADR nuevo que sustituye a otro; el antiguo solo cambia su estado. | [Decisiones](decisions.md) |
| `specgate adr list` | Cada ADR con su número, título y estado. | [Decisiones](decisions.md) |
| `specgate stack` | Escribe `docs/specs/stack.md`: la tecnología y la evidencia de cada capa, y los comandos. | [Decisiones](decisions.md) |
| `specgate studio --team` | El studio para un equipo detrás de un proxy con inicio de sesión: roles, y ediciones como pull requests. | [El studio para un equipo](studio-team.md) |
| `specgate review <change>` | El change como una página HTML autónoma para personas de fuera del repo. | [Revisar con negocio](business-review.md) |
| `specgate agents init` | Comandos slash y archivos de instrucciones para tus herramientas de agente. | [Agentes](agents.md) |
| `specgate agents init --format skills` | Los mismos pasos como carpetas de Agent Skills, en `.agents/skills/` y en las de cada herramienta. | [Agentes](agents.md#conectalo) |
| `specgate agents install --global` | Los guards de agente para todos los proyectos: el plugin de OpenCode, el de Claude Code. | [Agentes](agents.md) |
| `specgate agents init --tool codex-hooks` | Los guards de Codex para este proyecto, en `.codex/hooks.json`. | [Agentes](agents.md#los-guards) |
| `specgate update` | Refresca esos archivos generados tras actualizar, conservando tus cambios. | [Agentes](agents.md) |
| `specgate agent ask "<request>"` | Tu agente propone un cambio del spec como un plan con su diff; no se escribe nada. `@REQ-NNN`, `@path`. | [Pregunta a tu agente](agent-ask.md) |
| `specgate agent apply <plan-id>` | Escribe el plan si sus archivos no cambiaron desde entonces, y después ejecuta sus checks. Nunca hace commit. | [Pregunta a tu agente](agent-ask.md) |
| `specgate agent discard <plan-id>` | Elimina un plan. | [Pregunta a tu agente](agent-ask.md) |
| `specgate agent plans` | Los planes abiertos, y cuáles están obsoletos. | [Pregunta a tu agente](agent-ask.md) |
| `specgate mcp install --client claude` | Escribe la configuración del servidor MCP para Claude Desktop o Cursor. | [El servidor MCP](mcp.md) |
| `specgate mcp serve` | Ejecuta el servidor MCP por stdio. Lo arranca el cliente, no tú. | [El servidor MCP](mcp.md) |

## Packs de dominio

| Comando | Qué hace | Detalles |
| --- | --- | --- |
| `specgate specops add` | Instala un pack en un tag fijado y lo registra en `.specops.lock`. | [Packs de dominio](domain-packs.md) |
| `specgate specops remove` | Quita un pack de `.specops.lock`. | [Packs de dominio](domain-packs.md) |
| `specgate specops sync` | Vuelve a generar los packs instalados, conservando tus cambios locales. | [Packs de dominio](domain-packs.md) |
| `specgate specops diff` | Previsualiza un salto de versión; `--as-change` lo convierte en un change. | [Packs de dominio](domain-packs.md) |
| `specgate specops contribute` | Devuelve un cambio local al pack. Nunca hace push. | [Packs de dominio](domain-packs.md) |
| `specgate pack init` | Crea el esqueleto de un pack nuevo. | [Packs de dominio](domain-packs.md) |
| `specgate pack lint` | Comprueba un pack antes de que nadie lo instale. | [Packs de dominio](domain-packs.md) |
| `specgate pack infer` | Propone un `pack.yaml` a partir de un archivo `.feature`. | [Packs de dominio](domain-packs.md) |
| `specgate pack bundle` | Exporta un repositorio de pack como un único archivo para redes sin conexión. | [Cadena de suministro](supply-chain.md) |
| `specgate expand` | Generación de packs a bajo nivel. Mejor `specops add`. | [Packs de dominio](domain-packs.md) |

## Personalizar

| Comando | Qué hace | Detalles |
| --- | --- | --- |
| `specgate config set test_cmd "<cmd>"` | Los tests que ejecutan `check` y `apply`. | `specgate config set --help` |
| `specgate config set arch_cmd "<cmd>"` | Tu check de arquitectura, que el gate ejecuta junto a los tests. | [Validar](validating.md) |
| `specgate config set test_cmd_affected "<cmd> {files}"` | Lo que ejecutan `check --affected` y `apply`, con `{files}` los tests seleccionados. | [Un gate más rápido](fast-gate.md) |
| `specgate config set acceptance_cmd "<cmd> {files}"` | Lo que ejecuta los tests de aceptación sellados en `check`, con `{files}` sus rutas. | [Tests de aceptación sellados](reviewing-changes.md) |
| `specgate config set stack "<stack>"` | El stack que `AGENTS.md` declara al agente, que no puede elegir uno; igual con `testing`. | [Resolución de problemas](troubleshooting.md#agentes) |
| `specgate config set profile full` | Hace que `--help` liste todos los comandos (`core` lista el ciclo). | `specgate config set --help` |
| `specgate config set language es` | El idioma de la prosa generada. Las palabras clave se quedan en inglés. | `specgate config set --help` |
| `specgate config set profiles.<name>.<field>` | Un perfil de agente en `.harness/profiles.yaml`: agent, advisory, coste, precios. | [Elegir tu agente](agent-setup.md#haz-commit-de-los-comandos-que-usa-tu-equipo) |
| `specgate config set checks.<name>.<field>` | Un check de calidad en `harness.config.yaml`; fijar su `run` lo añade. | [Checks de calidad](quality.md) |
| `specgate config set alm.<key>` | `alm.config.yaml`: proveedor, URL, proyecto; `*_env` recibe el nombre de una variable. | [Jira y Azure Boards](alm.md) |
| `specgate config keys` | Cada ajuste: sus valores, el predeterminado, el actual y el archivo donde vive. | `specgate config set --help` |
| `specgate config init` | Escribe un `project.yaml` inicial. | `specgate config init --help` |
| `specgate schema which` | Muestra qué grafo de artefactos sigue un change (también `init`, `fork`, `validate`). | `specgate schema --help` |
| `specgate completion zsh` | Imprime el autocompletado de shell para bash, zsh o fish. | `specgate completion --help` |

## Los detalles

| Comando | Qué hace | Detalles |
| --- | --- | --- |
| `specgate pet` | Gato, el gato que guarda el gate: la salud del proyecto como mascota. | `specgate pet --help` |
| `specgate config set pet off` | Oculta a Gato del final de `status`. | `specgate config set --help` |

## Salida y códigos de salida

Muchos comandos aceptan `--json` y entonces imprimen un documento JSON en la
salida estándar; [el contrato del agente](specs/agent-contract.md) lista el
formato y cada código de diagnóstico. Desde Node, `status`, `questions`,
`matrix`, `report` y `lastCheck` son también funciones de
`@rsaglobaltech/specgate/api` que responden el mismo documento dentro del proceso:
[Lee un proyecto desde Node](automation.md#lee-un-proyecto-desde-node).

| Código | Significado |
| ---- | ---------------------------------------------------- |
| `0`  | Éxito, incluidos los avisos consultivos |
| `1`  | Fallo, o un gate que encontró algo |
| `2`  | Error de uso: un flag desconocido o un argumento que falta |
| `3`  | Falta un script necesario (una instalación rota) |

## Nombres antiguos

Estos nombres siguen funcionando, así que los scripts antiguos siguen
ejecutándose. Usa el nombre nuevo en todo lo que escribas.

| Nombre antiguo | Usa en su lugar |
| ------------------------- | ------------------------------- |
| `specgate draft`          | `specgate propose --from-brief` |
| `specgate done`           | `specgate apply`                |
| `specgate change new`     | `specgate propose`              |
| `specgate change archive` | `specgate archive`              |
