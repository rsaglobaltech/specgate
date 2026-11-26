<!-- translation-of: ea16a8048e05 -->
# El gate en CI

Un gate que solo se ejecuta en portátiles es una sugerencia. Al final de esta
página el gate se ejecuta en cada pull request de tu CI, un gate en rojo
bloquea el merge, y sabes qué hace cada línea del job generado y cómo
mantenerlo al día.

**Necesitas:** el gate pasando en tu máquina ([En tu máquina](local.md)) y un
repositorio en GitHub, GitLab, Azure DevOps o Jenkins.

<!-- specgate:diagram pr-in-ci -->

## Escribe el job

`specgate init` y `specgate adopt` ya lo escribieron, para el CI que muestra
el repositorio. Escríbelo de nuevo, o para otro CI:

```bash
specgate ci init                       # the provider the repository shows
specgate ci init --provider gitlab     # github | gitlab | azure | jenkins
specgate ci init --stdout              # print it, write nothing
specgate ci init --force               # overwrite the file that is there
```

| Proveedor | Archivo | Para pegar |
| --- | --- | --- |
| GitHub Actions | `.github/workflows/spec-gate.yml` | su propio workflow |
| GitLab CI | `.gitlab-ci.yml` | un job `spec-gate`: pégalo en el tuyo si ya tienes uno |
| Azure Pipelines | `azure-pipelines.yml` | pasos: pégalos en el tuyo si ya tienes uno |
| Jenkins | `Jenkinsfile` | una etapa `Spec gate`: pégala en el tuyo si ya tienes uno |

Luego pregunta qué comprueba y qué le falta:

```bash
specgate ci status
```

```text
  ◆ specgate · ci status   .github/workflows/spec-gate.yml

  ✔  the specification (validate --strict)
  ✔  the project's tests (check runs test_cmd)
  ✔  the architecture check (check runs arch_cmd)
  ✔  Ubuntu, macOS and Windows
  ✔  the requirement ids against the base branch (check --base)
  ✔  the quality checks (quality run)
  ✔  the pack drift (validate --against-lock)
  ✔  the pending-work plan (plan --format json)

  ✔  Everything specgate can check runs in CI.
```

## GitHub Actions, paso a paso

El job de GitHub es el completo. Cada paso dice en el YAML qué comprueba y qué
borrar para quitarlo:

| Paso | Qué hace | ¿Quitarlo? |
| --- | --- | --- |
| Ubuntu, macOS, Windows | El mismo gate en los tres, porque las rutas, los finales de línea y los shells difieren | Borra dos entradas de `os:` para quedarte con una |
| `checkout` con `fetch-depth: 0` | Todo el historial, para poder comparar los ids con la rama base | Solo junto con `--base`, más abajo |
| Toolchain y dependencias | Node, o un JDK para Maven y Gradle, y las dependencias del proyecto, para sus tests | No |
| **El gate** | `check --base origin/<base>`: ids, especificación, arquitectura, tests; y lo que la rama cambia en los controles, como `controls_changed_on_branch` para quien revisa | Nunca: esto es el gate |
| Checks de calidad | `quality run --stage ci`, solo en Ubuntu, porque los checks se ejecutan en Docker. Sin configurar: dice cómo, y pasa | Borra el paso |
| Deriva de packs | `validate --against-lock`: los packs de dominio siguen coincidiendo con `.specops.lock`. Sin packs: se omite | Borra el paso |
| Plan de trabajo pendiente | `plan --format json`, guardado como el artifact `spec-plan` de la ejecución | Borra los dos pasos |

Un paso cuya herramienta aún no está configurada (sin `test_cmd`, sin checks
de calidad, sin packs) lo dice en el log y pasa, así que el job está en verde
desde el primer día y comprueba más a medida que configuras más.

Un solo job en Ubuntu que ejecuta solo el gate, si es todo lo que quieres:

```bash
specgate ci init --provider github --minimal --force
```

## GitLab, Azure y Jenkins

Sus jobs ejecutan el gate, la deriva de packs y el plan, en una sola imagen
Linux. Este es el de GitLab, tal como lo escribe
`specgate ci init --provider gitlab --stdout`:

```yaml
spec-gate:
  image: node:22
  stage: test
  script:
    - npm install
    # The gate: the specification and the project's tests.
    - |
      npx @rsaglobaltech/specgate@1.5.0 check .
    # Supply-chain gate: fails when rendered pack content no longer matches the
    # digest pinned in .specops.lock. Skipped when no packs are installed.
    - >
      if [ -f .specops.lock ]; then
        npx @rsaglobaltech/specgate@1.5.0 validate . --against-lock;
      else
        echo "No .specops.lock — no packs installed, nothing to check.";
      fi
    - npx @rsaglobaltech/specgate@1.5.0 plan --project-dir . --format json > spec-plan.json
  artifacts:
    when: always
    paths:
      - spec-plan.json
```

El de Azure ejecuta los mismos tres como pasos en `ubuntu-latest`, y publica
el plan como artifact del build; el de Jenkins, como pipeline declarativo en
un contenedor `node:22`, y archiva el plan en `post { always }`.

**Lo que aún no hacen**, comparados con el de GitHub: comparar los ids con la
rama base y ejecutar los checks de calidad de la etapa `ci`. Añade ambos a
mano: haz fetch de la rama a la que apunta el merge request y pásala como
`--base`. En GitLab, en un pipeline de merge request:

```yaml
spec-gate:
  variables:
    GIT_DEPTH: 0
  script:
    - npm install
    - git fetch origin "$CI_MERGE_REQUEST_TARGET_BRANCH_NAME"
    - npx @rsaglobaltech/specgate@1.5.0 check . --base "origin/$CI_MERGE_REQUEST_TARGET_BRANCH_NAME"
    - npx @rsaglobaltech/specgate@1.5.0 quality run --stage ci --base "origin/$CI_MERGE_REQUEST_TARGET_BRANCH_NAME"
```

La rama destino es `$(System.PullRequest.TargetBranchName)` en Azure Pipelines
y `$CHANGE_TARGET` en un pipeline multibranch de Jenkins; haz fetch de ella de
la misma forma. Los checks de calidad se ejecutan en Docker, así que el job lo
necesita: un servicio `docker:dind` en GitLab, un agente con Docker en
Jenkins; el `ubuntu-latest` de Azure ya lo tiene.

## Conviértelo en check obligatorio

Un job que falla no detiene un merge por sí solo:

| Proveedor | Dónde | Qué activar |
| --- | --- | --- |
| GitHub | Settings → Rules → Rulesets (o Branches) | **Require status checks to pass** y selecciona `spec-gate`. Haz push de una rama una vez antes, para que GitHub haya visto el job. |
| GitLab | Settings → Merge requests | **Pipelines must succeed** |
| Azure DevOps | Repos → Branches → tu rama → Branch policies | **Build validation** con el pipeline, en **Required** |
| Jenkins | La protección de ramas de tu SCM | Exige el estado que Jenkins reporta para la etapa `Spec gate`: lo reporta el plugin GitHub o Bitbucket Branch Source |

Con `--base`, el log del job también nombra lo que la rama cambia en los
controles —el guard, `.specgate/gate.yaml`, las aprobaciones, la evidencia—
como `controls_changed_on_branch`, un warning por defecto (regla `controls`).
Es para quien revisa: haz que `.specgate/` y
`docs/specs/changes/*/approvals.json` tengan code owners, para que un cambio
en ellos necesite su revisión.

Protege también `develop` si haces merge de features en ella.
[El primer pull request de tu equipo](../first-pr.md) cubre lo que hacen el
autor y el revisor una vez que el check está en su sitio.

## Fija la versión y muévela a propósito

Cada comando generado ejecuta `@rsaglobaltech/specgate@<version>`, la versión
que lo escribió. Una versión nueva puede hacer el gate más estricto, y un
pipeline no debe cambiar bajo una rama en verde. Para pasar a una versión
nueva:

1. Actualiza en local y ejecuta `specgate check`. Corrige lo que encuentre la
   nueva versión, o regístralo ([Adóptalo sin un build en rojo](baselines.md)).
2. Cambia la versión en el archivo de CI (un buscar y reemplazar), o escribe
   el job de nuevo con `specgate ci init --force` si nunca lo editaste.
3. Abre un pull request con ambas cosas: CI demuestra el nuevo gate sobre el
   mismo código.

`specgate update` refresca los archivos de los agentes tras una actualización;
no toca el archivo de CI, que es tuyo.

## Secretos y cachés

- **Packs de dominio privados**: un secreto `SPECOPS_TOKEN` con acceso de
  lectura a su repositorio. El job de GitHub se lo pasa al paso de deriva de
  packs.
- **Los checks de calidad** reciben *nombres* de variables de entorno mediante
  `env:` en `harness.config.yaml` (`SONAR_TOKEN`, un token de registro) y leen
  sus valores de los secretos del CI. Un valor escrito en el archivo se
  rechaza.
- **Imágenes Docker**: `specgate quality doctor --pull` descarga la imagen de
  cada check antes de la ejecución. Guárdalas en caché, o los volúmenes de
  dependencias (`specgate-m2`, `specgate-gradle`, `specgate-npm`), con la
  caché de tu CI.

## Varios proyectos

- **Un monorepo**: lista sus proyectos en `projects:` de
  `specops.config.yaml`, y `validate` en la raíz valida cada uno y falla con
  un resumen por proyecto.
- **Varios repositorios de un mismo producto**: un solo gate para todos; mira
  [Workspace](../workspace.md).

## Tu propio pipeline

Cada comando del gate acepta `--json`: un documento en la salida estándar con
cada etapa, su comando, su resultado y sus hallazgos, cada uno con un `code`
estable y un `fix`. Ramifica según `code`, nunca según el mensaje. Los códigos
de salida son `0`, `1` y `2`. El contrato completo:
[El contrato JSON](../agents.md#the-json-contract).

```bash
npx @rsaglobaltech/specgate@1.5.0 check . --ci --json > gate.json
```

## Siguiente

- [Adóptalo sin un build en rojo](baselines.md)
