<!-- translation-of: 49d593cbc212 -->
# Preguntas frecuentes

Las preguntas que hacen los equipos la primera semana, con la respuesta corta y
dónde está la larga.

## Adoptarlo

### ¿Funciona en un repositorio que ya existe?

Sí, y es el caso habitual. `specgate init` ve el código
(`pom.xml`, `package.json`, `go.mod`, `pyproject.toml`, `Cargo.toml`, …),
adopta el repositorio en su sitio y no toca ningún archivo de código. El gate
está en verde el mismo día porque un requisito `Draft` todavía no debe nada.
→ [Primeros pasos](getting-started.md)

### ¿Qué lenguajes y herramientas de build?

Cualquiera. Specgate lee markdown, Gherkin y nombres de archivo; el enlace entre
un requisito y un test es una mención de `REQ-NNN`, que cualquier lenguaje puede
llevar en un comentario o en el nombre de un test. Tu propio comando de tests
ejecuta tu suite.

### ¿Necesito Node.js?

Node.js 22 o posterior para la CLI. Sin él: la imagen de Docker
(`ghcr.io/rsaglobaltech/specgate`), o los plugins de Maven y Gradle en un agente
de build JVM.

### ¿Tengo que usar DDD, arquitectura hexagonal o CQRS?

No. Los patrones son opcionales; los principios no
([ADR-0022](specs/adr/0022-patterns-are-optional-principles-are-not.md)). La matriz tiene columnas para casos de uso,
comandos, agregados y eventos; déjalas como `-` si tu sistema no tiene ninguno.

### ¿Necesito Cucumber?

No. Los escenarios se escriben en Gherkin para que *puedan* ejecutarse y para
que el gate pueda comprobarlos, pero el gate enlaza un requisito con cualquier
test que lo mencione. Si usas Cucumber, el gate lee su protocolo de mensajes y
rechaza un escenario que ejecutó cero pasos.

### ¿Cómo dejamos de usarlo?

Borra `spec.md`, `features/`, `docs/specs/` y el job de CI. La adopción nunca
tocó tu código, así que nada más depende de ello.

## De dónde viene el trabajo

### ¿Puede empezar el trabajo desde un ticket de Jira?

Sí. `specgate propose --from-ticket KAN-13` lee la historia de Jira y abre un
change a partir de su descripción y sus criterios de aceptación, en una rama con
el nombre del ticket. `--check` comprueba antes el ticket frente a la Definition
of Ready (reglas T1 a T9). Construyes y archivas el change como siempre, y
después `specgate alm pr <change-id>` abre un pull request por ticket en GitHub.
Jira solo se lee. → [Desde un ticket de Jira](from-a-ticket.md)

### ¿Un brief, un ticket o ninguno?

| Tienes | Usa |
| --- | --- |
| Un comportamiento que añadir o cambiar | Ninguno: `specgate propose <change-id>` |
| Una funcionalidad con unas pocas reglas (de dos a seis) | Ninguno: `specgate propose <change-id>`, las reglas en el delta |
| Un producto nuevo, o un área grande de uno | Un brief: `docs/brief.md`, y después `specgate propose --from-brief` |
| Una historia de Jira con criterios de aceptación | El ticket: `specgate propose --from-ticket <KEY>` |

Los tres abren el mismo tipo de change y siguen el mismo ciclo de vida.
→ [Cada día: de dónde viene el trabajo](start/scratch-5-every-day.md)

## El día a día

### ¿Cada pull request necesita un requisito nuevo?

No. Una corrección de bug o un refactor que no cambia el comportamiento
contratado no añade ninguno, y el gate solo pide lo que deben los requisitos
entregados.
→ [El primer pull request de tu equipo](first-pr.md)

### ¿Cuándo se archiva un change: antes o después del código?

Después. `specgate propose` lo abre, sus requisitos cuentan mientras está
abierto (`status` los lista, `apply` los entrega) y `specgate archive` solo lo
fusiona cuando todos los requisitos que añade o modifica están `Implemented`.
Hasta entonces se niega con `archive_requirements_pending` y el `specgate apply`
que ejecutar; `--force` no se salta eso. El spec y el código llegan en el mismo
pull request ([ADR-0035](specs/adr/0035-four-verbs-one-lifecycle.md)).
→ [Cambiar un requisito ya entregado](reviewing-changes.md)

### ¿Qué nombres antiguos de comandos siguen funcionando?

Todos, como alias: `specgate draft` es `propose --from-brief`,
`specgate done` es `apply`, `specgate change new` es `propose` y
`specgate change archive` es `archive`. Las guías solo usan los nombres nuevos.
→ [Nombres antiguos](commands.md#nombres-antiguos)

`specgate new` no es un nombre antiguo: añade un requisito directamente a
`spec.md`, sin change, lo que conviene a un proyecto pequeño. La ayuda corta
muestra solo `init`, los cuatro verbos y `check`; `specgate --help --all` muestra el resto.

### ¿Quién edita la matriz de trazabilidad?

Nadie. Se genera a partir de `spec.md`, las etiquetas de los escenarios y los
archivos que mencionan cada requisito. Haz commit de lo que regenera
`specgate check`; CI falla con `matrix_stale` cuando lo olvidas.
→ [Cómo piensa Specgate](concepts.md)

### Dos ramas cambiaron la matriz y ahora hay conflicto.

Una matriz generada se declara `merge=union` en `.gitattributes`, así que git
conserva las filas de ambos lados y `specgate check` la regenera. En una
configuración antigua, quédate con cualquiera de los dos lados y ejecuta
`specgate matrix`: se regenera a partir de las fuentes fusionadas, así que el
conflicto se resuelve solo.
→ [El harness](harness.md)

### Dos ramas cogieron el mismo id de requisito.

`specgate check` compara los ids con la rama base (`--base`, o la predeterminada
de origin) y falla con `id_taken_on_base` cuando el mismo id tiene otro título
ahí, antes del merge, nombrando el siguiente id libre en ambos lados.

### `apply` se niega. ¿Puedo forzarlo?

Primero lee el código. `apply_no_test` significa que ningún test menciona el
requisito: nómbralo en el test, esa es la corrección. Para un fallo del gate,
`specgate apply REQ-NNN --no-check` escribe el estado sin el gate. Úsalo cuando
el gate se equivoca, dilo en el pull request y abre una incidencia, porque un
gate que se equivoca es un bug.

### `check` dice que comprobó la especificación, no el código.

No hay comando de tests configurado, así que nada ejecutó tus tests. Ejecuta
`specgate config set test_cmd "npm test"` una vez, o pasa `--test-cmd "npm test"`. Hasta entonces un
`check` en verde significa que la especificación es coherente, nada más.

### ¿Qué mira un revisor?

El requisito, su escenario y el test que lo menciona, no la matriz. Lo único
que el gate no puede detectar es un test que nombra un requisito y no lo
prueba. → [El primer pull request de tu equipo](first-pr.md)

## Agentes

### ¿Qué agente de IA necesita?

Ninguno. Cada comando funciona a mano. `specgate init` instala los comandos
slash para los agentes que encuentra en tu proyecto (`CLAUDE.md`, `.cursor/`, …); `specgate agents init`
los escribe para cualquier otro, con comandos slash y reglas para Claude Code, Cursor, Copilot, Windsurf,
Aider, Gemini, Cline, Codex, OpenCode o Antigravity. → [Herramientas de agente](agents.md)

### ¿Puede un agente reescribir el spec para que pase su propio test?

No en silencio. Cada capa cierra una puerta distinta:

- **Aprobar es cosa de una persona.** `specgate change approve` rechaza una
  sesión sin terminal, así que un agente no puede aprobar su propio change, y
  `apply` rechaza uno sin aprobar. La aprobación sella cada requisito por su
  hash: uno cambiado después hace fallar el gate (`approved_requirement_changed`).
- **Tests de aceptación sellados.** Los tests que una persona aprobó con
  `--layer acceptance` quedan sellados por hash; si cambian, hacen fallar el
  gate (`acceptance_not_sealed`).
- **Los hooks guard** de Claude Code, OpenCode y Codex rechazan código antes que
  un test, escrituras en tests sellados y en archivos de control, y los propios
  comandos de la persona.
- **Por MCP**, las herramientas que escriben la especificación se niegan salvo
  que haya un change abierto o el equipo haya fijado `mcpAllowContractEdits`. No
  hay herramienta para aprobar.
- **El juez externo.** En el harness, tocar `spec.md`, `features/**` o las
  reglas hace fallar el intento, y también cualquier cambio en los controles
  (`controls_changed_by_session`). Sin harness ni CI, esta comprobación no
  existe.

→ [Agentes](agents.md#los-guards) · [El servidor MCP](mcp.md) · [El harness](harness.md)

### ¿Hará merge el harness de su trabajo?

No por defecto. Deja una rama por requisito y se detiene. Hacer merge es un
juicio, y una herramienta que hace merge de su propio trabajo elimina el último
lugar donde una persona lo revisa. Cuando lo pides con
`specgate harness run --chain`, ejecuta los requisitos de uno en uno, cada uno
partiendo del merge anterior, hace merge de uno en verde con un commit de merge
en la rama en la que estás, vuelve a ejecutar el gate sobre el merge y se
detiene en el primer fallo.
→ [El harness](harness.md)

### ¿Puedo ver lo que está haciendo el agente?

Sí: `specgate studio`, y después abre `/live`. Muestra el intento, la fase, los
archivos, los tests y los pasos de cada requisito mientras se ejecuta el
harness, ligado a esta máquina salvo que `--host` diga otra cosa.
→ [Referencia de comandos](commands.md#personalizar)

### ¿Puedo usarlo sin la terminal?

Sí: `specgate studio` es todo el camino como app —crear el proyecto, escribir el
brief, redactar, responder, aprobar, construir y leer el informe— y cada acción
ejecuta el comando que habrías escrito. → [El studio](studio.md)

### ¿Sustituye a SonarQube, Snyk o SpotBugs?

No: los ejecuta. Un [check de calidad](quality.md) es la herramienta de tu
equipo en su imagen de Docker, juzgada para que solo falle lo que añade un
change; SonarQube Community se ejecuta en local sin cuenta.

### ¿Cuánto cuesta una ejecución del harness?

Lo que cueste tu agente. El harness mide tiempo de reloj; un perfil puede
declarar una estimación de coste, y `specgate harness report` la multiplica y
dice que la cifra es declarada, no medida.

## Seguridad y operaciones

### ¿Envía telemetría la CLI?

No. Solo hace llamadas de red cuando pides algo remoto:

- `specgate propose --from-ticket <KEY>` lee el ticket de Jira y sube la nueva
  rama con tus credenciales de git;
- `specgate alm pr` sube la rama del ticket y llama a la API de GitHub para
  abrir o actualizar su pull request;
- `specgate alm sync` escribe en Jira (o Azure Boards, o GitHub Issues): crea y
  cierra incidencias;
- `specgate alm pull` lee incidencias etiquetadas;
- un pack descargado de una URL de git, y `npx` descargando el propio paquete.

### ¿Puede funcionar sin conexión?

Sí. Usa la imagen de Docker o un paquete incluido en el repositorio, e instala
los packs desde un bundle de git (`specgate pack bundle`). → [Cadena de suministro](supply-chain.md)

### ¿Qué instala?

Un paquete sin ninguna dependencia de runtime. Cada versión publica un SBOM
CycloneDX, y su política de licencias es un gate del build. → [Cadena de suministro](supply-chain.md)

### ¿Cómo fijamos la versión en CI?

`specgate ci init` escribe el job con la versión que lo generó
(`npx @rsaglobaltech/specgate@<version>`), así que CI no cambia de
comportamiento el día que se publica una versión nueva.

## Comparado con otros

### ¿En qué se diferencia de OpenSpec o Spec Kit?

Sobre todo en lo que pasa después de escribir la especificación: una matriz que
CI hace cumplir, Gherkin que un runner puede ejecutar, packs de dominio
versionados y un harness sin supervisión. El ciclo diario tiene la misma forma
que el de OpenSpec —`propose`, `apply`, `archive`—, pero `apply` necesita un test
que nombre el requisito y un gate en verde, y `archive` rechaza el trabajo que no
está hecho. OpenSpec es más pequeño, y si solo quieres el ciclo de changes sin
gate, encaja mejor. → [Comparativas](comparisons.md)

## Siguiente

- [Primeros pasos](getting-started.md) — instalar, elegir tu camino, los cuatro verbos
- [Resolución de problemas](troubleshooting.md) — cuando el gate dice que no y no estás de acuerdo
