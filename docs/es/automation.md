<!-- translation-of: 43378fd762a4 -->
# Automatización

Esta página conecta el ciclo de Specgate con las herramientas que tu equipo ya
usa: agentes, editores, hooks de git, CI sin Node y Jira. Elige las secciones
que necesites; cada una se sostiene sola.

**Necesitas:** un proyecto donde se haya ejecutado `specgate init`, y Specgate
instalado como dependencia de desarrollo (`npm install --save-dev @rsaglobaltech/specgate`).
El job de CI en sí se explica en [Validar](validating.md#run-it-in-ci).

## Dale a un agente el ciclo por MCP

Un cliente MCP (Claude Desktop, Cursor, Claude Code, Antigravity) puede ejecutar
el ciclo como herramientas: qué está abierto, el gate, entregar un requisito. El
servidor viene dentro de la CLI:

```bash
specgate mcp install --client claude
```

Las herramientas que escriben la especificación se niegan si no hay un change
abierto. La configuración, la lista de herramientas y el guard están en
[El servidor MCP](mcp.md).

## Instala el plugin de Claude Code

El plugin le da a Claude Code el ciclo como comandos slash, el árbol de specs
por MCP y un hook que ejecuta el gate antes de que una sesión pueda terminar.

```bash
specgate agents init --tool claude-plugin --project-dir ./specgate-plugin
```

Eso escribe un plugin completo: `.claude-plugin/plugin.json`, nueve comandos
slash en `commands/specgate/`, un `.mcp.json` que arranca el servidor MCP, y
`hooks/hooks.json` con tres hooks: el inicio de sesión, el guard en cada llamada
a herramienta (primero el test, los actos de una persona, los archivos de
control y los tests sellados) y el gate (consulta [Agentes](agents.md#los-guards)).
Codex recibe los mismos hooks con `--tool codex-hooks`.

**El hook es lo que ningún archivo de instrucciones puede hacer.** Las demás
herramientas de agente reciben texto que un agente puede seguir o no. Un plugin
recibe un hook `Stop`, que se ejecuta decida lo que decida el agente:

```
The spec gate is failing, so this work is not finished:

  • [strict_tdd_1] Test artifact is TBD but status is 'In Dev'
    fix: Write the test first, then set its path in the row's
         'Test artifact' column.

Run `specgate validate . --strict` to see all of it.
```

La sesión no termina mientras el gate falla. El hook bloquea **una vez por
prompt**: la segunda vez reporta los hallazgos y deja que la sesión termine,
porque una persona necesita ver la respuesta. Un proyecto sin `spec.md`, o una
máquina sin `specgate` en su `PATH`, se deja en paz.

`claude-plugin` es el único destino que `specgate agents init` no escribe por
defecto: un plugin es algo que instalas una vez, no un archivo para cada proyecto.

## Usa la extensión de VS Code

La extensión añade diagnósticos para `pack.yaml`, un enlace "Reveal in
traceability" sobre los ids de requisito y validación al guardar.

1. Constrúyela. Aún no está en el Marketplace: en un clon del
   [repositorio de Specgate](https://github.com/rsaglobaltech/specgate/tree/main/packages/vscode-spec-driven),
   ejecuta `npm run package` en `packages/vscode-spec-driven` y después instala
   el archivo `.vsix` con **Extensions → Install from VSIX…**.
2. Abre la raíz de un proyecto. La extensión encuentra `spec.md` y
   `docs/specs/traceability.md` por su cuenta.
3. Abre un `pack.yaml`: los errores de esquema aparecen en el panel Problems.
4. Pasa el ratón por encima de un `REQ-NNN` (o `UC-`, `SCN-`, `AGG-`, `EVT-`,
   `RUL-`, `CMD-`) para obtener **Reveal in traceability**.
5. Para validar al guardar, abre los ajustes, busca **Spec-Driven** y marca
   `validateOnSave`.

| Ajuste | Por defecto | Para qué |
| --- | --- | --- |
| `spec-driven.validateOnSave` | `false` | Ejecutar `validate` en cada guardado. |
| `spec-driven.codeLens` | `true` | Mostrar "Reveal in traceability". |
| `spec-driven.cliPath` | `npx @rsaglobaltech/specgate` | El comando que ejecuta Specgate. |
| `spec-driven.schemaPath` | incluido | Un `pack.schema.json` propio. |

## Entrega requisitos con el harness

El **harness** es el ciclo sin supervisión de Specgate. `specgate harness run`
da cada requisito pendiente a un agente en su propio worktree de git, ejecuta el
gate y marca el requisito Implemented con `specgate apply` cuando el gate pasa.
No hace merge de nada salvo que pases `--chain`. `specgate studio` muestra la
ejecución en directo, en `/live`.

→ [El harness](harness.md) · [Elegir y conectar tu agente](agent-setup.md)

## Ejecuta el gate sin Node

Los jobs de CI generados llaman a `npx`, que necesita Node. Cuando un agente de
build no tiene Node (el agente de Jenkins de un equipo Java, un runner
restringido), usa la imagen de Docker o los plugins de Maven y Gradle.

**Docker.** Monta el workspace y ejecuta el gate:

```bash
docker run --rm -v "$PWD:/workspace" \
  ghcr.io/rsaglobaltech/specgate:1.6.0 validate . --strict
```

Fija la versión: `latest` vale en un portátil, pero un gate que cambia por
debajo de un pipeline no es un gate. Las imágenes se publican para `linux/amd64`
y `linux/arm64`. Los tags anteriores a 0.8.0 solo existen con el nombre
anterior de la herramienta, `ghcr.io/rsaglobaltech/csda`, y su comando no es
`specgate`; usa 0.8.0 o posterior.

En GitLab CI, ese es todo el job:

```yaml
spec-gate:
  image: ghcr.io/rsaglobaltech/specgate:1.6.0
  stage: test
  script:
    - specgate validate . --strict
```

En Jenkins:

```groovy
stage('Spec gate') {
    agent { docker { image 'ghcr.io/rsaglobaltech/specgate:1.6.0' } }
    steps { sh 'specgate validate . --strict' }
}
```

**Maven o Gradle.** Si el build ya ejecuta uno de ellos, vincula el gate a una
fase en lugar de añadir un contenedor:

```xml
<plugin>
  <groupId>com.rsaglobaltech</groupId>
  <artifactId>specgate-maven-plugin</artifactId>
  <executions>
    <execution>
      <goals><goal>validate</goal></goals>
    </execution>
  </executions>
</plugin>
```

El goal `validate` se vincula a la fase `verify`, así que `mvn verify` ejecuta el
gate. `plan` y `doctor` también son goals. Los plugins apuntan a Java 11, porque
un agente de build corporativo es donde no puedes elegir el JDK.

**Aún no publicado.** El plugin no está en Maven Central. Hasta que lo esté,
ejecuta `mvn -f packages/maven-plugin install` en un clon del repositorio de
Specgate para ponerlo en tu repositorio Maven local. La imagen de Docker no
necesita nada.

## Ejecuta el gate en un hook pre-commit

Un hook detecta un requisito sin escenario o sin test antes de que el commit
salga de tu máquina. Con git a secas, sin herramientas extra:

```bash
# .git/hooks/pre-commit  (make it executable: chmod +x)
#!/usr/bin/env bash
set -e
npx specgate validate . --strict
if [ -f .specops.lock ]; then
  npx specgate validate . --against-lock
fi
```

El segundo comando falla cuando los archivos que generó un pack de dominio ya no
coinciden con la versión del pack registrada en `.specops.lock`.

O con **husky**:

```bash
npm install --save-dev husky
npx husky init
echo 'npx specgate validate . --strict' > .husky/pre-commit
```

Cualquiera puede saltarse un hook con `git commit --no-verify`, así que ejecuta
el mismo gate también en CI: consulta [Validar](validating.md#run-it-in-ci).

## Lee un proyecto desde Node

Una herramienta escrita en Node —un editor, un panel, el studio— puede leer un
proyecto sin arrancar `specgate` en cada lectura:

```ts
import { status, questions, matrix, report, lastCheck, API_VERSION } from "@rsaglobaltech/specgate/api";

const open = (await questions("path/to/project")).questions.open;
for (const q of open) console.log(q.id, "blocks", q.blocks.join(", "));
```

Cada función responde exactamente lo que imprime el comando con `--json`:

| Función                                    | Responde lo que imprime                                        |
| ------------------------------------------ | -------------------------------------------------------------- |
| `status(dir)`                              | `specgate status --json`                                       |
| `questions(dir)`                           | `specgate questions --json`                                    |
| `matrix(dir)`                              | `specgate matrix --json --dry-run`                             |
| `report(dir, { capability })`              | `specgate report --format json --stdout [--capability <name>]` |
| `lastCheck(dir)`                           | `specgate check --last --json`                                 |
| `harnessStop(dir, { afterCurrent: true })` | `specgate harness stop --after-current --json`                 |
| `agentAsk(dir, request, options)`          | `specgate agent ask "<request>" --json`                         |
| `agentApply(dir, id)`                      | `specgate agent apply <id> --json`                             |
| `agentDiscard(dir, id)`                    | `specgate agent discard <id> --json`                           |
| `agentPlans(dir)`                          | `specgate agent plans --json`                                  |

`matrix(dir)` lista las filas, una por escenario, como `matrix.scenarios`, cada
una con su `requirement`, `scenario`, `feature`, `tests`, `code`, `status`, los
enlaces que le faltan como `gaps` (`feature`, `test`, `code`) y la pregunta
abierta que la bloquea como `waiting`; `matrix.rows` sigue siendo el recuento.
`status(dir)` da a cada requisito su `capability`. `report(dir)` lleva la
cobertura de líneas del proyecto como `coverage.lines`, y rechaza una capacidad
que el proyecto no tiene con el código `capability_unknown`.

Los hallazgos están en `status`, cada uno con su código, mensaje y corrección,
como en [el contrato del agente](specs/agent-contract.md). Las lecturas no
escriben ningún archivo del proyecto —una matriz derivada detrás de sus specs se
deriva en memoria, no se reescribe— y no arrancan ningún proceso salvo
`git ls-files`. `harnessStop` escribe un archivo, la petición de parada junto a
los eventos del harness, ignorado por git. Una carpeta sin proyecto specgate se
rechaza con el código `not_a_project` y la corrección `specgate init`. Los
documentos que imprime `harness run` también tienen tipos ahí:
`HarnessRunReport` para `--format json`, y `HarnessStreamEvent` para cada línea
de `--format jsonl`. Los planes del agente son la excepción que arranca un
proceso: `agentAsk` ejecuta tu agente sobre una copia de trabajo y guarda su plan
en la carpeta de git, y `agentApply` escribe los archivos del plan y ejecuta sus
checks; consulta [Pregunta a tu agente](agent-ask.md).

Los tipos vienen con el paquete. `API_VERSION` es `1.0.0`; su número mayor solo
cambia cuando se rompe la forma de una respuesta. Los comandos que cambian el
proyecto (`apply`, `archive`, `config set`) no están en la API: ejecútalos con
la CLI, donde están el gate y su salida.

## Conecta Jira

Specgate trabaja con Jira de dos modos. Elige uno por proyecto.

| Modo | Qué hace Specgate en Jira | Empieza por |
| --- | --- | --- |
| Un ticket como origen de un change | Solo lee. El tablero avanza con reglas de Jira Automation. | [Desde un ticket de Jira](from-a-ticket.md) |
| Un espejo de tus requisitos | Escribe: una incidencia por requisito, cerrada cuando está hecho. | [Jira y Azure Boards](alm.md) |

En el primer modo, `specgate propose --from-ticket <KEY>` abre un change a
partir de una historia y sus criterios de aceptación, y
`specgate alm pr <change-id>` abre un pull request por ticket. En el segundo,
`specgate alm sync` mantiene las incidencias al día con los requisitos, y
`specgate alm pull` abre un change por cada incidencia etiquetada. Azure Boards
admite el modo espejo.

## Siguiente

- [El harness](harness.md)
- [Desde un ticket de Jira](from-a-ticket.md)
