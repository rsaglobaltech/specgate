<!-- translation-of: ffebfda8619c -->
<!-- specgate:allow-placeholders -->

# Checks de calidad y seguridad

El gate demuestra que un requisito está especificado, enlazado y probado. Los
**checks de calidad** demuestran más: que los tests ejecutan el código que
añadió el change, que notarían un bug en él, que no añade ninguna
vulnerabilidad, secreto filtrado ni violación de arquitectura, y que sus
commits dicen lo que hacen. Cada check es una herramienta en la que tu equipo
ya confía —JaCoCo, PIT, SpotBugs, Semgrep, gitleaks, SonarQube—, que Specgate
ejecuta en su contenedor y juzga de modo que **solo lo que añade un change
puede hacerlo fallar**. Al final de esta página sabrás activarlos en un
proyecto Java o Node, tomar una baseline y leer un fallo.

**Necesitas:** un proyecto donde se haya ejecutado `specgate init` o
`specgate adopt`, git y Docker (Docker Desktop en Windows y macOS). Nada más:
cada herramienta se ejecuta en su propia imagen y ninguna necesita cuenta. La
decisión es [ADR-0040](specs/adr/0040-quality-and-security-in-the-gate.md).

## Actívalos

```bash
specgate quality init --level basic      # or --level strict
specgate quality doctor --pull           # how each check runs here; fetch the images
specgate quality baseline                # today's findings are debt, not failures
git add harness.config.yaml .specgate/quality-baseline.json .gitignore
git commit -m "chore: quality checks"
```

`quality init` lee los archivos de build —`pom.xml`, `build.gradle`,
`package.json`— y escribe los checks del nivel en `harness.config.yaml`,
conservando todas las demás líneas. En un monorepo también lee la carpeta de
cada app —un nivel por debajo, o en `apps/`, `packages/` y `services/`—
cuando la raíz no tiene archivo de build de ese stack: el `apps/api/pom.xml`
de forja recibe los checks de Maven, ejecutados como `cd apps/api && mvn …`.
Un check cuya herramienta le falta a tu build se escribe comentado, con lo que
hay que añadir (PIT necesita su plugin de JUnit 5 en el pom, la cobertura de
Vitest su provider). El paso de proyecto nuevo del studio pregunta el nivel, y
su página de proyecto los activa o los sube:

![La tarjeta Code quality del studio: Docker responde, el nivel basic con un umbral de cobertura del diff del 70 %, y sus checks —commits en local, secretos en Docker—, cada uno con cuándo se ejecuta y si bloquea el gate.](assets/img/studio-quality.webp)

## Los dos niveles

| Check | Qué ejecuta | basic | strict |
| --- | --- | --- | --- |
| `commits` | Conventional Commits 1.0.0, de forma nativa | cada intento | cada intento |
| `secrets` | gitleaks | cada intento | cada intento |
| `dependencies` | osv-scanner sobre el lockfile; en Maven, sobre la lista de materiales que escribe `sbom` | al final | cada intento |
| `coverage` | JaCoCo / Vitest / Jest, y luego Specgate mide las líneas cambiadas | cada intento, 70 % | cada intento, 85 % |
| `types`, `lint` | `tsc --noEmit`, ESLint (Node) | cada intento | cada intento |
| `spotbugs` | SpotBugs (Java) | al final | cada intento |
| `pmd` | PMD (Java) | — | cada intento |
| `semgrep` | Las reglas de Semgrep para Java o TypeScript/React | — | al final |
| `mutation` | PIT (Java) o Stryker (Node), y luego Specgate puntúa las líneas cambiadas | — | al final, 70 % |
| `review` | un segundo agente lee el change frente al requisito | — | al final, aconseja |
| `sonar` | SonarQube Community, en local | — | comentado: unos 2 GB |

`diff_coverage:` y `mutation_score:` en `harness.config.yaml` sustituyen los
umbrales del nivel.

## Dónde se ejecutan

| Momento | attempt | end | ci |
| --- | :-: | :-: | :-: |
| Cada intento del harness, después de que pasen los tests | sí | sí, cuando pasan los checks del intento | |
| `specgate check` | sí | sí | |
| `specgate check --ci` | sí | sí | sí |
| `specgate quality run [--stage attempt\|end\|ci]` | según se pida | según se pida | según se pida |

En el harness, un check que falla hace fallar el intento en
`quality check: <name>`, y lo que encontró —los hallazgos nuevos, las líneas
que ningún test ejecutó, los mutantes que sobrevivieron— va al prompt del
siguiente intento con la indicación de corregir, no de silenciar. Un check que
no puede ejecutarse aquí (Docker parado, falta un token) se informa y se
omite; con `--ci` falla, porque CI debería tenerlo todo.

## Solo lo que añade un change

Una herramienta ejecutada sobre un código existente informa de toda su
historia. Specgate juzga un check que escribe SARIF por sus **hallazgos**, no
por su código de salida:

- Un hallazgo en `.specgate/quality-baseline.json` es deuda que el equipo ya
  conoce; nunca hace fallar el gate. `specgate quality baseline` escribe el
  archivo; `--accept <check>` vuelve a tomar un check.
- Un hallazgo se reconoce por una huella que sobrevive a que el código se
  mueva: la de la propia herramienta cuando la escribe; si no, la regla, el
  archivo y el texto de la línea señalada con sus vecinas.
- Con `scope: diff` (por defecto) solo cuentan los hallazgos en archivos que
  tocó el change; `scope: all` para un check de todo el proyecto, como las
  dependencias.
- Fuera de un repositorio git no se sabe qué ha cambiado, así que cuenta todo
  hallazgo que no esté en la baseline.
- Un hallazgo en un archivo que git ignora —un `.env.local` de desarrollo— se
  deja fuera: nunca forma parte de un change ni del repositorio.

Un fallo nombra cada hallazgo nuevo como `path:line [rule] message`. Haz commit
de la baseline; solo se reduce, salvo que alguien ejecute `baseline --accept`
a propósito.

## Las dos medidas que calcula Specgate

Ninguna herramienta las calcula por change, así que lo hace Specgate, a partir
de los informes que las herramientas ya escriben:

- **Cobertura del diff** — de las líneas ejecutables añadidas o cambiadas
  desde la rama base (con commit o sin él; un archivo nuevo cuenta entero), la
  proporción que ejecutó un test. Se lee de JaCoCo XML, LCOV o Cobertura. Por
  debajo del umbral nombra cada línea cambiada que ningún test ejecuta. Un
  change sin ninguna línea ejecutable pasa.
- **Puntuación de mutación** — de los mutantes en esas líneas, la proporción
  que mató un test. Se lee del `mutations.xml` de PIT o del `mutation.json` de
  Stryker; los supervivientes se nombran como `path:line mutator`. PIT se
  apunta solo a las clases cambiadas, así que sigue siendo rápido.

## Referencia de `checks:`

```yaml
quality: strict
diff_coverage: 85
mutation_score: 70
commit_types: [wip]          # Conventional Commits types beyond the defaults
checks:
  - name: spotbugs
    run: "mvn -B -q compile com.github.spotbugs:spotbugs-maven-plugin:4.8.6.6:spotbugs -Dspotbugs.sarifOutput=true"
    when: attempt            # attempt | end | ci
    gate: true               # false: reported, never fails
    runner: docker           # docker | local | auto
    image: maven:3.9-eclipse-temurin-21
    volumes: [specgate-m2:/root/.m2]
    sarif: target/spotbugsSarif.json
    timeout: 900
```

| Clave | Significado |
| --- | --- |
| `run` | El comando; o `builtin:commits`, `builtin:sonar`, `builtin:review`, `builtin:adversary` |
| `report` | `jacoco:`, `lcov:`, `cobertura:`, `pit:` o `stryker:` y una ruta: una medida que toma Specgate |
| `sarif` | El SARIF que escribe la herramienta, juzgado frente a la baseline |
| `scope` | `diff` (por defecto) o `all` |
| `env` | **Nombres** de variables de entorno que se pasan al contenedor; un valor se rechaza |
| `volumes` | Volúmenes con nombre para cachés, `name:/path`; una carpeta del host se rechaza |
| `network` | `false` ejecuta el contenedor sin red |
| `profile` | Para `review` y `adversary`: el perfil cuyo agente lo ejecuta |
| `docker` | `true` da al contenedor el Docker del host, para tests que arrancan contenedores (Testcontainers); los presets de Maven y Gradle lo activan cuando el build declara Testcontainers |
| `needs` | Un check anterior cuya salida lee este (el `dependencies` de Maven necesita `sbom`); `quality baseline` lo ejecuta primero |

`specgate config set` escribe un check sin abrir el archivo, conservando sus
demás líneas y comentarios; fijar el `run` de un check lo añade:

```bash
specgate config set checks.lint.run "npm run lint"
specgate config set checks.lint.when end
specgate config set diff_coverage 80
```

Un valor que el lector rechazaría se rechaza antes de escribir el archivo, con
`config_value_invalid` y la corrección: `runner: docker` necesita antes su
`image`, `when` es attempt, end o ci. `specgate config keys` lista todos los
campos.

Placeholders en `run`: `{req}`, `{base}`, `{changed_files}`,
`{changed_classes}` (Java, para PIT), `{changed_src}` (TypeScript, para
Stryker) y `{report_dir}`. `{changed_classes@apps/api}` y
`{changed_src@apps/web}` conservan solo los archivos de esa carpeta, relativos
a ella.

## Docker

Todos los presets escriben `runner: docker`: los plugins del propio build se
ejecutan con el Maven, Gradle o npm del proyecto dentro de su imagen, y los
escáneres en las suyas. Una máquina necesita Docker y nada más, y un portátil
ejecuta lo mismo que CI.

- Docker debe ejecutar **contenedores Linux**: las imágenes son de Linux.
  Docker Desktop en modo contenedores Windows se informa como tal, y los
  checks se omiten hasta que lo cambies.
- El proyecto se monta en `/src`; en Linux y macOS los archivos que escribe un
  contenedor se te devuelven, nunca se quedan como de root.
- Las cachés de dependencias viven en volúmenes con nombre (`specgate-m2`,
  `specgate-gradle`, `specgate-npm`), así que la segunda ejecución no descarga
  medio mundo.
- Las imágenes están fijadas; `specgate quality doctor --pull` las descarga
  antes de una ejecución, que es como CI debería precalentarlas.

## SonarQube, sin cuenta

`run: builtin:sonar` arranca SonarQube Community en un contenedor llamado
`specgate-sonarqube`, solo en <http://127.0.0.1:9123>, la primera vez que se
ejecuta. Specgate crea una vez un token de análisis con el login por defecto y
lo guarda en `.specgate/sonar.local`, que añade a `.gitignore`; nunca cambia
la contraseña. Entra con `admin` / `admin` y cámbiala. Cuando lo hayas hecho,
da a Specgate un token que crees allí como `SONAR_TOKEN`. Las incidencias
vuelven como SARIF, así que la baseline las juzga como las de cualquier check.
Necesita unos 2 GB de memoria; por eso `strict` lo lista comentado.

## Conventional Commits

`builtin:commits` comprueba cada commit desde la base frente a
[Conventional Commits 1.0.0](https://www.conventionalcommits.org/en/v1.0.0/):
`type(scope)!: description`, una línea en blanco antes del cuerpo,
`BREAKING CHANGE:` en mayúsculas. Los commits de merge se dejan fuera, y los
`fixup!`/`squash!` fuera de CI. El harness pide a su agente
`feat(REQ-007): …`, y los commits que escribe Specgate siguen el formato.

## Un segundo agente

`builtin:review` hace que un agente lea el change frente al requisito y sus
escenarios y responda `VERDICT: PASS` o `FAIL` con sus razones;
`builtin:adversary` hace que uno escriba un test que intenta romper el change.
Ambos se ejecutan solo dentro del harness, aconsejan salvo con `gate: true`, y
nunca tocan el trabajo de quien implementa: el worktree vuelve a quedar
exactamente como estaba.

## También tu herramienta de arquitectura

Con `arch_sarif:` junto a `arch_cmd:`, el check de arquitectura se juzga del
mismo modo: `specgate quality baseline` registra sus hallazgos como `arch`, y
solo falla una violación que añade el change ([ADR-0028](specs/adr/0028-architecture-conformance-is-part-of-the-gate.md)).

## Dónde se ven los resultados

- `specgate harness report` — la calidad de lo entregado: cobertura del diff y
  puntuación de mutación, la media, y con qué frecuencia se ejecutó cada check.
- `specgate report --format json` — la cobertura de líneas del proyecto como
  `coverage.lines` (`percent`, `covered`, `total`, `tool`, `file`,
  `measuredAt`), leída del informe que nombra un check en `report:`; si no, del
  más reciente de `coverage/lcov.info`, `coverage/coverage-summary.json`,
  `coverage/cobertura-coverage.xml`, `coverage.xml`,
  `target/site/jacoco/jacoco.xml` y
  `build/reports/jacoco/test/jacocoTestReport.xml`. Sin ninguno, es `null` con
  `coverage_not_measured` y cómo hacer que tu stack escriba uno; nunca 0.
- La vista en vivo — cada check es un paso del gate, con su medida.
- El studio — la página del proyecto lista los checks y cómo se ejecuta aquí
  cada uno; el informe lleva las cifras de cada requisito.

## Cuando algo sale mal

| Lo que ves | Qué hacer |
| --- | --- |
| `Docker is not running here` | Arranca Docker Desktop, o el daemon. |
| `no report at …` | La herramienta no escribió su informe: ¿está el plugin en el build (JaCoCo, el provider de cobertura de Vitest)? |
| `no SARIF at …` | La herramienta falló antes de escribirlo; su salida está encima de la línea. |
| Un check encuentra la misma incidencia antigua en cada change | Toma la baseline: `specgate quality baseline --accept <check>`. |
| `SonarQube's default login no longer works` | Crea un token en `/account/security` y fija `SONAR_TOKEN`. |
| PIT es lento | Está acotado a las clases cambiadas; da al check un `timeout` mayor. |

## Siguiente

- [Validar](validating.md) — todo lo demás que comprueba el gate.
- [El harness](harness.md) — donde los checks alimentan al agente.
- [El studio](studio.md) — lo mismo, sin los comandos.
