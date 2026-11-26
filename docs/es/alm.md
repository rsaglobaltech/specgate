<!-- translation-of: 89192aa6bfa6 -->
# Jira, Azure Boards, GitHub y Linear

Esta página es la referencia para conectar Specgate a un tracker de trabajo (un
ALM: Jira, Azure Boards, GitHub Issues o Linear) y a los pull requests de GitHub.
Cubre las dos formas de conectar Jira, cada clave de `alm.config.yaml` y los
comandos `specgate alm`. Para una configuración paso a paso con Jira, lee
primero [Desde un ticket de Jira](from-a-ticket.md).

## Dos formas de conectar Jira: elige una

|                          | El ticket como fuente                               | El espejo                                                                    |
| ------------------------ | --------------------------------------------------- | ---------------------------------------------------------------------------- |
| Dónde empieza el trabajo | Una historia en Jira, con criterios de aceptación   | Un requisito en el spec                                                      |
| Qué hace Specgate        | **Lee** un ticket cada vez                          | **Escribe**: crea una incidencia por requisito y la cierra                   |
| Comandos                 | `specgate propose --from-ticket`, `specgate alm pr` | `specgate alm sync`, `specgate alm pull`                                     |
| Cómo se mueve el tablero | Jira Automation, a partir de ramas y pull requests  | `alm sync` cierra una incidencia cuando su requisito está hecho              |
| Scope del token de Jira  | `read:jira-work`                                    | `read:jira-work` y `write:jira-work`                                         |
| Guía                     | [Desde un ticket de Jira](from-a-ticket.md)         | Esta página, desde [Refleja los requisitos](#refleja-los-requisitos-alm-sync) |

Elige una por proyecto. Usar ambas da a cada historia un segundo conjunto de
incidencias: las que crea `alm sync` para sus requisitos.

**El ticket como fuente** encaja con un equipo cuyos analistas ya escriben
historias con criterios de aceptación. `specgate propose --from-ticket` lee la
descripción, los criterios y las preguntas abiertas, los comprueba frente a una
Definition of Ready y abre un change cuyo borrador se comprueba frente a esos criterios.

**El espejo** encaja con un equipo que escribe primero los requisitos en el
spec y quiere que el tablero los refleje. El spec y la matriz de trazabilidad
siguen siendo el contrato: una incidencia refleja un requisito, nunca lo define
([ADR-0021](specs/adr/0021-alm-is-a-mirror.md)).

## El archivo de configuración

`alm.config.yaml` está en la raíz del proyecto. **Los tokens nunca van en este
archivo**: nombra la variable de entorno que contiene cada uno, así que el
archivo se puede subir al repositorio sin riesgo y CI aporta el secreto.

```yaml
alm_version: 1
provider: jira # jira | azure | github | npm:<package>
base_url: https://acme.atlassian.net
project_key: HIE
token_env: JIRA_TOKEN
user_env: JIRA_USER
cloud_id: auto
```

Qué claves lee un proveedor lo declara el propio proveedor:

<!-- specgate:alm-provider-table — checked by tests/unit/alm-conformance.test.ts -->

| Proveedor | Obligatorias                           | Opcionales                                                                        |
| --------- | -------------------------------------- | --------------------------------------------------------------------------------- |
| `jira`    | `base_url`, `project_key`, `token_env` | `user_env`, `issue_type`, `subtask_type`, `cloud_id`, `acceptance_field`, `epics` |
| `azure`   | `base_url`, `project_key`, `token_env` | `issue_type`, `done_state`                                                        |
| `github`  | `repo`, `token_env`                    | `base_url`                                                                        |
| `linear`  | `team_key`, `token_env`                | `base_url`                                                                        |

`alm_version`, `provider`, `pr`, `phases` y `mirror` se leen para todos los
proveedores; los dos últimos hacen que el tablero siga cada change: ver
[El tablero sigue al change](alm-phases.md). Una clave que el proveedor
configurado no lee se informa como `alm_config_unread_key`, con el proveedor
que la habría leído.

### Todas las claves

| Clave              | Proveedor   | Qué contiene                                                                          |
| ------------------ | ----------- | ------------------------------------------------------------------------------------- |
| `alm_version`      | todos       | El formato del archivo: `1`                                                           |
| `provider`         | todos       | `jira`, `azure`, `github`, o `npm:<package>` para un proveedor de la comunidad        |
| `base_url`         | jira        | El sitio: `https://your-site.atlassian.net`                                           |
|                    | azure       | La organización: `https://dev.azure.com/<org>`                                        |
|                    | github      | Solo para GitHub Enterprise Server: la URL de su API                                  |
| `project_key`      | jira        | La clave del proyecto, `KAN`. Solo se leen incidencias de este proyecto               |
|                    | azure       | El nombre del proyecto                                                                |
| `repo`             | github      | `owner/name`                                                                          |
| `token_env`        | todos       | El nombre de la variable que contiene el token de la API                              |
| `user_env`         | jira        | El nombre de la variable que contiene el email de la cuenta (por defecto `JIRA_USER`) |
| `cloud_id`         | jira        | `auto`, o el id del sitio: enruta las peticiones por el gateway de Atlassian          |
| `issue_type`       | jira, azure | El tipo que crea `alm sync` (por defecto `Task`)                                      |
| `done_state`       | azure       | El estado al que cierra `alm sync` (por defecto `Done`)                               |
| `acceptance_field` | jira        | El campo con los criterios de aceptación, `customfield_10050`, si no es la descripción |
| `epics`            | jira        | Un mapa de clave de épica a capacidad: `KAN-5: entry-exit`                            |
| `pr`               | todos       | El bloque para `specgate alm pr`, abajo                                               |

Toda URL debe usar `https` (`http` sin cifrar solo para `localhost`), porque se
le envía el token.

`specgate config set` escribe estas claves sin abrir el archivo, creándolo con
`alm_version: 1` cuando no existe y conservando sus demás líneas:

```bash
specgate config set alm.provider jira
specgate config set alm.base_url https://acme.atlassian.net
specgate config set alm.project_key KAN
specgate config set alm.token_env JIRA_TOKEN
specgate config set alm.pr.base main
```

Cada clave es `alm.<key>`, y las del bloque `pr:` son `alm.pr.<key>`; `epics`
se escribe a mano. Una clave que termina en `_env` solo acepta el nombre de una
variable —mayúsculas, dígitos y `_`—, así que un token pegado ahí se rechaza
con `config_value_invalid`, y ninguna clave contiene un token: `alm.token` se
rechaza como `config_key_unknown`, con la corrección que nombra la variable.

**`cloud_id`.** Un token de Jira creado _con scopes_, el tipo que Atlassian
ofrece primero, lo rechaza el propio sitio: Jira lo responde como una petición
anónima, así que una búsqueda no devuelve nada en lugar de un error. Un token
así solo funciona a través del gateway de Atlassian,
`https://api.atlassian.com/ex/jira/<cloud id>`. `cloud_id: auto` lee el id del
sitio sin enviarle el token; los enlaces a incidencias conservan `base_url`.
Un 401 del sitio nombra esta corrección.

**`done_state` es solo de Azure.** Los workflows de Jira difieren por proyecto,
así que allí «hecho» es una _categoría_ de estado, y cerrar significa
encontrar una transición hacia ella.

**`acceptance_field` y `epics`** solo sirven a `propose --from-ticket`. Una
historia cuya épica no está en `epics:` necesita `--capability <name>`.

### El bloque `pr:`

| Clave       | Por defecto              | Qué contiene                                                 |
| ----------- | ------------------------ | ------------------------------------------------------------ |
| `provider`  | `github`                 | El único soportado                                           |
| `repo`      | (obligatoria)            | `owner/name`                                                 |
| `base`      | `develop`                | La rama a la que apuntan los pull requests                   |
| `token_env` | `GITHUB_TOKEN`           | El nombre de la variable que contiene el token de GitHub     |
| `base_url`  | `https://api.github.com` | La URL de la API; cámbiala solo para GitHub Enterprise Server |

El token de `pr.token_env` debería ser un token fine-grained para este único
repositorio, con Pull requests en lectura y escritura. No uses un token
personal amplio como el que imprime `gh auth token`. El push usa tus
credenciales de git habituales, no este token.

## Abre el pull request de un ticket: `alm pr`

```bash
specgate alm pr kan-13-register-vehicle-entry
specgate alm pr kan-13-register-vehicle-entry --no-check
```

Para un change abierto con `--from-ticket`, abierto o archivado, en la rama del
ticket, `alm pr` hace push de la rama y abre un pull request contra `pr.base`,
titulado con la clave y el resumen del ticket. El cuerpo enlaza el ticket y el
change, lista cada requisito con su estado e indica si `specgate check` pasa;
`--no-check` se salta el check y lo dice. `--no-push` se salta el push.

Ejecútalo otra vez para actualizar el mismo pull request: reescribe solo su
propio bloque de la descripción y conserva un título que editó una persona,
siempre que el título siga nombrando la clave. Se niega en otra rama o con
cambios sin commit, y nunca hace merge, cierra ni borra nada. El bucle completo
está en [Desde un ticket de Jira](from-a-ticket.md#the-daily-loop-per-ticket).

## Refleja los requisitos: `alm sync`

```bash
export JIRA_TOKEN=…  JIRA_USER=…
specgate alm sync --dry-run        # the plan only: nothing is created or closed
specgate alm sync                  # do it, and write .specops/alm-map.json
specgate alm status                # the requirement ↔ issue mapping, no network
specgate alm link REQ-007 HIE-42   # adopt an issue that already exists
```

`alm sync` crea una incidencia para cada requisito que no tiene una, cierra la
incidencia cuando su requisito llega a un estado de hecho, e informa de la
**deriva**: una incidencia cerrada mientras su requisito sigue abierto. Nunca
resuelve la deriva por ti ni reabre un requisito; lo resuelve una persona.

`.specops/alm-map.json` es la correspondencia y **va en git**. Es lo que hace
que `sync` sea seguro de ejecutar dos veces, y lo que deja que otra máquina
continúe. `sync` sale con 1 cuando encuentra deriva, así que funciona como job programado de CI.

**En GitHub, cerrada no siempre es hecha.** GitHub registra por qué se cerró
una incidencia. Solo **completed** cuenta como hecha; **not planned** deja el
requisito abierto y aparece como deriva, porque el trabajo se abandonó, no se entregó.

## Trae incidencias: `alm pull`

```bash
specgate alm pull --label spec-driven            # one change per labelled issue
specgate alm pull --label spec-driven --dry-run  # see what it would open
```

Cada incidencia abierta con la etiqueta se convierte en un change,
`docs/specs/changes/alm-<key>/`, con una propuesta que cita la incidencia
palabra por palabra y un delta con un requisito. `alm pull` solo lee el título
y la descripción, así que **deja el escenario sin escribir**, y el change no
valida hasta que alguien lo escribe. Es a propósito: generar Given/When/Then a
partir de prosa libre inventaría justo lo que el spec existe para fijar.

Cuando la incidencia es una historia de Jira con criterios de aceptación, usa
`specgate propose --from-ticket <KEY>` en su lugar: lee los criterios y
comprueba el borrador frente a ellos.

Traer dos veces es seguro: un change que ya existe se omite. Azure no puede
buscar por etiqueta (busca con WIQL), así que `alm pull` lo dice en Azure en
lugar de fallar.

## Proveedores: cuatro integrados, más de la comunidad

`jira`, `azure`, `github` y `linear` son **integrados**: se mantienen en este
repositorio y se prueban contra respuestas grabadas en cada ejecución de CI.
Cualquier otro tracker se puede añadir como paquete:

```yaml
provider: npm:specgate-alm-youtrack
```

```bash
npm install --save-dev specgate-alm-youtrack   # you install it; specgate never does
```

**Un proveedor de la comunidad es código que se ejecuta en tu proceso, y recibe
el token de tu tracker.** Trátalo como cualquier devDependency: léelo, fíjalo,
revisa sus actualizaciones. Specgate nunca lo instala por ti, solo acepta un
nombre de paquete (ni ruta ni URL) y comprueba el módulo frente al contrato de
proveedor antes de llamarlo.

### Escribir un proveedor

Exporta un objeto que cumpla `AlmProvider`: `id`, `label`, `config` (las claves
que exige y lee), `capabilities` y una factoría `create(cfg, fetchImpl)`.
Recibir `fetchImpl` deja que los tests de conformidad ejecuten el proveedor
contra respuestas grabadas sin red. Declara las capacidades con honestidad:
`listIssues: false` es una respuesta válida y hace que `alm pull` se explique
en lugar de fallar. `scripts/alm/port.ts` documenta cada campo.

Para añadir un proveedor integrado, pon un módulo bajo `scripts/alm/providers/`,
regístralo en el `index.ts` de esa carpeta y añade un fixture grabado en
`tests/fixtures/alm/<id>.json`. `tests/unit/alm-conformance.test.ts` ejecuta
entonces contra él la misma suite que contra los cuatro proveedores integrados.

## Siguiente

- [El tablero sigue al change](alm-phases.md)
- [Desde un ticket de Jira](from-a-ticket.md)
- [Automatización](automation.md)
