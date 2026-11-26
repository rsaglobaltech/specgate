<!-- translation-of: 04c2213d00d9 -->
# A partir de un ticket de Jira

Al final de esta página, una historia de Jira se convierte en un change
revisado, construido y con merge en un solo pull request, y el ticket avanza
por el tablero solo. La primera mitad es la configuración inicial que hace quien
lidera el equipo; la segunda es el ciclo que el equipo sigue con cada ticket.

## Lo que obtienes

Un analista escribe una historia con criterios de aceptación. Specgate la lee,
nunca escribe en ella, y la usa como texto de origen de un **change**: una
carpeta con los requisitos y escenarios que se añaden, comprobados contra el
ticket (¿palabras nuevas? mira [Conceptos](concepts.md#vocabulario)).

```
KAN-13 in Jira (To Do)
  → specgate propose --from-ticket KAN-13       branch feature/KAN-13-… pushed   → In Progress
  → the agent drafts the change against the ticket's acceptance criteria
  → a person reviews the draft and approves it: specgate change approve <change-id>
  → build: by hand with specgate apply, or with specgate harness run --chain
  → specgate archive kan-13-register-vehicle-entry     on the branch, before the PR
  → specgate alm pr kan-13-register-vehicle-entry      one pull request "KAN-13 …"  → In Review
  → CI runs the gate; a reviewer approves; merge                                    → Done
```

| Quién         | Hace                                                                                    |
| ------------- | --------------------------------------------------------------------------------------- |
| Analista      | Escribe la historia en Jira y corrige lo que reporta el check del ticket                |
| Líder técnico | Hace la configuración inicial de abajo; revisa los borradores, o nombra quién lo hace    |
| Desarrollador | Abre el change, lo construye (o ejecuta el harness), lo archiva y abre el PR             |
| Agente        | Redacta los requisitos y escenarios a partir del ticket; puede construirlos sin supervisión |

Jira mueve el ticket con sus propias reglas de Automation, a partir de lo que
le dice GitHub. Specgate en sí solo lee Jira.

## Requisitos previos

- Un proyecto que ya usa Specgate (`specgate init`), con un comando de tests
  configurado (`specgate config set test_cmd "npm test"`) y el gate en CI
  (`specgate ci init`). Mira [El primer PR de tu equipo](first-pr.md).
- Jira Cloud, con permiso para editar el workflow y la automatización del proyecto.
- Un repositorio de GitHub en el que puedas hacer push, con permisos de admin para la protección de ramas.
- Una herramienta de agente (Claude Code, OpenCode, Cursor, Codex…) para escribir el borrador
  ([Agentes](agents.md)).

## Configuración inicial

Haz estos pasos en este orden. Los pasos 5 y 6 deben estar terminados antes de
que nadie haga push de la primera rama de un ticket.

### 1. Un token de la API de Jira

1. En tu cuenta de Atlassian, en **Security → API tokens**, crea un token
   **con scopes**, para Jira, con el único scope `read:jira-work`. Specgate
   no necesita nada más, porque solo lee.
2. Mantenlo fuera del repositorio: en el entorno de tu shell, en el llavero del
   sistema, o como secreto enmascarado en CI. Guarda el email de la cuenta a su lado.

```bash
export JIRA_TOKEN="$(security find-generic-password -s jira-token -w)"   # macOS keychain
export JIRA_USER="lead@your-company.com"
```

Un token creado con scopes solo funciona a través del API gateway de Atlassian,
que selecciona `cloud_id: auto` (paso 3). Los tokens caducan: renuévalo antes de esa fecha.

### 2. Un token de GitHub para `alm pr`

`specgate alm pr` abre el pull request a través de la API de GitHub. Crea un
personal access token **fine-grained** con:

- **Repository access:** solo este repositorio.
- **Permissions:** Pull requests, lectura y escritura.

Expórtalo en la variable que nombra `pr.token_env` (`GITHUB_TOKEN` abajo). No
reutilices un token amplio como el que imprime `gh auth token`: puede hacer
mucho más que abrir un pull request. Hacer push de la rama no usa este token;
usa tus credenciales normales de git.

### 3. `alm.config.yaml`

Pon este fichero en la raíz del proyecto y commitéalo. Nombra variables de
entorno, nunca sus valores. Cada clave se describe en
[la referencia de configuración](alm.md).

```yaml
alm_version: 1
provider: jira
base_url: https://your-site.atlassian.net
project_key: KAN # only keys of this project are read
token_env: JIRA_TOKEN # the variable that holds the API token
user_env: JIRA_USER # the variable that holds the account's email
cloud_id: auto # required for a token created with scopes
acceptance_field: customfield_10050 # only if criteria live in their own field
epics: # which capability each epic's stories belong to
  KAN-5: entry-exit
  KAN-6: invoicing
pr: # for specgate alm pr
  provider: github
  repo: your-org/your-repo
  base: develop # the branch pull requests target
  token_env: GITHUB_TOKEN
```

Una **capacidad** es un área de la especificación, como `invoicing`. Una
historia cuyo epic no está bajo `epics:` necesita `--capability <name>` al abrirla.

### 4. La app GitHub for Jira

Instala la app _GitHub for Jira_ desde el Atlassian Marketplace y conecta tu
organización de GitHub. Muestra, dentro de cada ticket, cada rama, commit y
pull request cuyo nombre o mensaje lleva la clave del ticket, y da a Jira
Automation los disparadores que se usan en el paso 6.

### 5. El workflow de Jira

El workflow del proyecto necesita cuatro estados: **To Do**, **In Progress**,
**In Review** y **Done**. Haz que cada uno sea alcanzable desde cualquier estado
(en el editor de workflows, marca _Allow all statuses to transition to this one_).
Sin eso, la regla "pull request created" falla para un ticket que sigue en To
Do, porque no hay transición directa de To Do a In Review.

### 6. Las reglas de automatización

En **Project settings → Automation**, crea estas reglas antes de que exista la
primera rama de un ticket. Una rama a la que se hizo push antes de existir su
regla nunca la dispara.

| Cuándo (disparador)  | Si (condición)    | Entonces (acción)         |
| -------------------- | ----------------- | ------------------------- |
| Branch created       | —                 | Transition to In Progress |
| Commit created       | Status is To Do   | Transition to In Progress |
| Pull request created | —                 | Transition to In Review   |
| Pull request merged  | —                 | Transition to Done        |

La regla del commit es una red de seguridad: mueve un ticket cuyo evento de rama se perdió.

### 7. Protección de ramas

El gate solo bloquea un merge cuando se le dice a GitHub que lo espere. En
**Settings → Branches**, añade una regla para la rama base (y para `main`):
exige un pull request, y exige que pase el status check del job que escribió
`specgate ci init` (`spec-gate`). Sin esto, un pull request en rojo se puede
seguir integrando.

### 8. Una prueba con un ticket

Elige una historia pequeña y sigue una vez el ciclo diario de abajo. Comprueba
que el ticket muestra la rama y pasa a In Progress, que el pull request aparece
en él y lo pasa a In Review, y que el merge lo pasa a Done. Corrige cualquier
paso que no se haya disparado antes de que empiece todo el equipo.

## ¿Está listo el ticket?

Puedes enviar esta sección a tus analistas tal cual.

```bash
specgate propose --from-ticket KAN-13 --check
```

Esto lee el ticket y no escribe nada. Busca cuatro partes en la descripción:

- **La intención:** el texto "As a … I want … so that …".
- **La fuente:** una línea `Source:`, cuando la historia sale de un documento.
- **Los criterios de aceptación:** bajo "Acceptance Criteria", "Akzeptanzkriterien"
  o "Criterios de aceptación", idealmente un elemento "Given …, when …, then …"
  por criterio. Un tablero que guarda los criterios en un campo propio fija
  `acceptance_field`.
- **Las preguntas abiertas:** bajo "Open questions", "Offene Fragen" o "Preguntas
  abiertas", cada una seguida de `Assumption: …`.

Después comprueba el ticket contra una Definition of Ready, las reglas T. Un
error debe corregirse antes de poder abrir un change; un aviso lo juzgas tú.
Cada corrección se hace en Jira, así que nadie necesita Specgate para actuar.

| Regla                 | Nivel   | Qué encuentra                                                      | La corrección, en Jira                                    |
| --------------------- | ------- | ------------------------------------------------------------------ | --------------------------------------------------------- |
| `T1_no_criteria`      | error   | Ningún criterio de aceptación                                      | Añade "Acceptance Criteria", un Given/When/Then por elemento |
| `T2_vague`            | error   | "fast", "user-friendly", "schnell", "rápido"…                      | Dilo con valores: "en 2 segundos"                         |
| `T8_orphan_subtask`   | error   | Una subtarea sin historia padre                                    | Asóciala a su historia                                    |
| `ticket_epic`         | error   | La clave es un epic                                                | Comprueba y abre sus historias en su lugar                |
| `T3_unmeasured`       | warning | Una cantidad prometida ("response time", "scalable") sin número    | Da el número y su unidad                                  |
| `T4_technical`        | warning | Un criterio que nombra una tecnología                              | Di lo que ve el usuario o el negocio                      |
| `T5_too_big`          | warning | Más de 8 criterios                                                 | Divide la historia                                        |
| `T6_test_instruction` | warning | Un criterio que prescribe tests ("unit tests cover…")              | Escribe cada caso que lista como un criterio propio       |
| `T7_not_behaviour`    | warning | Todos los criterios son entregables (Figma, wireframes, reviewed)  | Síguelo en el tablero; no es comportamiento que especificar |
| `T9_open_question`    | note    | Una pregunta sin supuesto declarado                                | Añade "Assumption: …" después de ella                     |

¿Sin acceso a la API? Exporta la incidencia como JSON y pasa `--from-ticket KAN-13.json`.

## El ciclo diario, por ticket

1. Mira qué toca: `specgate status` lista lo que está abierto y nombra el
   siguiente comando. En un proyecto configurado para Jira sin nada abierto, es
   `specgate propose --from-ticket <KEY> --check`.
2. Comprueba el ticket: `specgate propose --from-ticket KAN-13 --check`.
3. Abre el change, desde un working tree limpio:
   `specgate propose --from-ticket KAN-13`. Crea
   `feature/KAN-13-register-vehicle-entry` (`bugfix/…` para un Bug) a partir de
   `pr.base` o de la rama en la que estás, abre el change, lo commitea y hace
   push de la rama: el ticket pasa a In Progress, y cada clon ve los ids que
   reservó. `--no-push` lo deja en local; `--no-branch` mantiene tu rama.
4. Haz que el agente lo redacte:
   `specgate propose --from-ticket KAN-13 --agent "claude -p"`. Ejecuta
   `specgate propose --from-ticket KAN-13` hasta que diga **Ready to review**.
   El agente solo puede escribir dentro del change, nunca en la copia del ticket.
5. Una persona revisa el borrador contra `ticket.md`: un requisito por
   criterio, escenarios con los valores del propio ticket, `questions.md` respondido.
   Después lo commitea, para que el build parta de él:
   `git add -A && git commit -m "KAN-13 draft the change"`.
6. Construye cada requisito. A mano: escribe primero el test y nombra en él el
   requisito (`REQ-151`), escribe el código, después `specgate apply REQ-151`
   y commitea. `apply` no commitea. O deja que el harness los construya sin
   supervisión, un requisito cada vez, integrando cada uno en verde en esta
   rama; commitea por ti, como `KAN-13 REQ-151: …`
   (configuración: [El harness](harness.md)):

   ```bash
   specgate harness run --chain --agent "claude -p < {prompt_file}"
   ```

7. Archiva el change en la rama, ejecuta el gate, commitea:

   ```bash
   specgate archive kan-13-register-vehicle-entry
   specgate check
   git add -A && git commit -m "KAN-13 archive the change"
   ```

8. Abre el pull request, lo que pasa el ticket a In Review:
   `specgate alm pr kan-13-register-vehicle-entry`. Hace push de la rama y
   abre un pull request contra `pr.base`, titulado "KAN-13 Register vehicle
   entry", que lista cada requisito y si `specgate check` pasa. Si lo vuelves a
   ejecutar, actualiza el mismo pull request; nunca hace merge
   ([detalles](alm.md)).
9. CI ejecuta el gate; quien revisa aprueba; tú haces merge. El ticket pasa a Done.

**Cada mensaje de commit empieza por la clave del ticket**: `KAN-13 REQ-151: normalize
plates`. Jira muestra un commit solo cuando su mensaje nombra la clave, así que en
la rama de un ticket `specgate check` avisa con `ticket_key_missing` por cada commit
desde la base que no la nombra. No uses comandos de Smart Commit como `#done`:
escriben en Jira.

## Cuando el ticket cambia

`ticket.md`, la copia tomada al abrir el change, es el registro de lo que se
acordó. Si el analista edita el ticket después,
`specgate propose --from-ticket KAN-13 --check` reporta `ticket_changed`, con las líneas eliminadas y añadidas. Decide con el
analista si el change lo sigue. Si lo sigue, actualiza el delta y
`ticket.md` juntos, en un commit que nombre la clave.

Nunca edites `ticket.md` para que un valor encaje. Su hash se registra cuando se
lee, así que una copia editada se reporta como `ticket_copy_edited` y el borrador
deja de estar listo. Restáurala con `git checkout -- ticket.md`.

## Resolución de problemas

| Síntoma                                        | Causa                                                          | Corrección                                                               |
| ---------------------------------------------- | -------------------------------------------------------------- | ------------------------------------------------------------------------ |
| Una búsqueda no encuentra nada, o Jira responde 401 | Un token creado con scopes, enviado al sitio              | Pon `cloud_id: auto`; comprueba el scope `read:jira-work`                |
| El ticket nunca pasó a In Progress             | La regla se creó después del push de la rama                    | Muévelo a mano; la regla del commit atrapa el siguiente commit           |
| La regla "pull request created" falla          | No hay transición desde el estado del ticket a In Review       | Permite que todos los estados transicionen a In Review                   |
| Se hizo merge de un pull request con CI en rojo | No hay protección de ramas                                    | Exige el check `spec-gate` en la rama base                               |
| Faltan commits en el ticket                    | Sus mensajes no nombran la clave (`ticket_key_missing`)        | Reescríbelos para que empiecen por la clave                              |
| `ticket_copy_edited`                           | `ticket.md` se cambió después de leerlo                        | `git checkout -- ticket.md`; usa `--check` para ver qué cambió en Jira   |
| `alm pr` se niega: cambios sin commitear       | El pull request no los incluiría                               | Commitéalos, empezando por la clave, y vuelve a ejecutarlo               |
| `alm pr`: git push falló                       | Tus credenciales de git para `origin`                          | Corrígelas para que un `git push` normal funcione                        |
| `alm pr`: variable sin definir, o HTTP 401/403 | No hay token de GitHub, o uno sin escritura en Pull requests   | Exporta el token que nombra `pr.token_env` (paso 2 de la configuración)  |
| `ticket_epic`                                  | Pasaste la clave de un epic                                    | Abre sus historias, un change cada una                                   |
| `ticket_bad_key`                               | Un fichero exportado cuya clave no es como `KAN-13`            | Vuelve a exportar la incidencia desde Jira                               |
| `ticket_no_capability`                         | El epic de la historia no está bajo `epics:`                   | Asocia el epic, o pasa `--capability <name>`                             |
| `ticket_not_ready`                             | El ticket tiene errores de reglas T                            | Corrígelos en Jira; `--check` los lista                                  |
| No se creó la rama                             | Cambios sin commitear en el working tree                       | Commitéalos y vuelve a ejecutar el comando                               |

Más, por síntoma y por código: [Resolución de problemas](troubleshooting.md).

## Referencia

**Lo que contiene el change de un ticket**, bajo `docs/specs/changes/<key>-<slug>/`:

| Fichero                      | Qué contiene                                                               |
| ---------------------------- | -------------------------------------------------------------------------- |
| `ticket.md`                  | El ticket tal como se leyó, sin editar, con su enlace y la hora de lectura |
| `proposal.md`                | La intención, citada, y `ticket: KAN-13`                                   |
| `questions.md`               | Las preguntas abiertas del ticket, con el supuesto del analista como respuesta |
| `DRAFTING.md`                | Los criterios como alcance y sus valores como los únicos que usar          |
| `specs/<capability>/spec.md` | El delta: los requisitos y escenarios que escribir                         |
| `change.yaml`                | Los ids de requisito reservados, la clave del ticket y el hash de `ticket.md` |

**Dos formas de conectar Jira; elige una por proyecto.** Esta página es la
forma de solo lectura. La otra, `specgate alm sync`, escribe en Jira: una
incidencia por requisito, cerrada cuando está hecho ([compáralas](alm.md)). La
decisión de diseño es [ADR-0039](specs/adr/0039-the-ticket-as-source-text.md).

## Siguiente

- [Un código existente, con el trabajo en Jira](existing-project-with-jira.md)
- [Jira, Azure Boards y GitHub: cada clave de configuración](alm.md)
