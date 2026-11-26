<!-- translation-of: 95bd8dfc0328 -->
# Versiones y despliegue

Cómo se corta y se publica una versión de Specgate —en npm, en el registro de
contenedores y en este sitio de documentación— y qué soporte recibe.

<!-- specgate:note -->
**GitHub Actions está activado** (desde el 2026-10-28): el repositorio es
público, así que los runners estándar alojados en GitHub no cuestan nada. CI,
E2E y Security se ejecutan en cada push a `main` y `develop` y en los pull
requests; los workflows de publicación se ejecutan con un tag `v*`. Estuvieron desactivados meses para ahorrar una cuota que los repositorios públicos no tienen.
<!-- specgate:endnote -->

## Qué se publica

| Artefacto | Registro | Workflow | Estado |
|---|---|---|---|
| `@rsaglobaltech/specgate` | npm, público | `publish-npm.yml` | Activo — **1.5.0** es `latest`; `next` es 1.0.0-rc.12 |
| `@rsaglobaltech/specgate` | GitHub Packages | `publish-github-packages.yml` | Activo — la más reciente es **1.5.0** |
| Imagen de la CLI | `ghcr.io` | `publish-docker.yml` | Activo — imagen más reciente **1.5.0**, `linux/amd64` y `linux/arm64` |
| Servidor MCP | dentro del paquete de la CLI | `publish-npm.yml` | Activo: `specgate mcp serve` |
| Sitio de documentación y registro de packs | GitHub Pages | `pages.yml` | Activo — ver [Despliegue del sitio](#despliegue-del-sitio) |
| `specgate-maven-plugin` | Maven Central o un Nexus interno | ninguno aún | C7-05 |
| `specgate-gradle-plugin` | Gradle Plugin Portal o un repo interno | ninguno aún | C7-06 |
| `specgate-vscode` | VS Code Marketplace | ninguno aún | C7-07 |
| `@specgate/lsp-server` | npm | ninguno aún | C7-08, bloqueado por C6-03 |

Las dos filas de `@rsaglobaltech/specgate` son una misma coordenada en dos
registros, a propósito. El npm público es el de por defecto; enrutar el scope
con `@rsaglobaltech:registry=https://npm.pkg.github.com` obtiene la copia de GitHub.

## El cambio de nombre a Specgate: hecho, y lo que dejó

`create-spec-driven-app` pasó a ser `@rsaglobaltech/specgate`
([ADR-0024](specs/adr/0024-the-tool-is-renamed-the-format-is-not.md)); el
paquete antiguo está deprecado, no despublicado. El `specgate` sin scope choca
con `spec-gate` en npm (`403`, no es un problema de token). Imágenes: `ghcr.io/<owner>/specgate`.
Formato, caché y variables son todos `specgate` ([ADR-0032](specs/adr/0032-one-name-everywhere.md));
el paquete instala `specgate`, `sgate` (ADR-0042) y `create-spec-driven-app`.

## Versionado

Versionado semántico. La CLI y los paquetes complementarios versionan de forma
independiente; una versión de la CLI no obliga a subir la extensión de VS Code.

**Los tags son `vX.Y.Z`** (los workflows de publicación se disparan con `v*`).
Desde 1.0 la superficie pública se congela en cada versión —`npm run
contract:write` en el commit de la versión, `contract:check --release <version>`
antes del tag—; ver [Lo que promete 1.0](compatibility.md).

## Política de soporte

**Qué versiones reciben correcciones.** Antes de 1.0, solo la última minor. No
se prometen backports a una minor anterior: el camino de actualización es
hacia delante, y fingir lo contrario sería un compromiso que un solo
mantenedor no puede cumplir. La misma tabla está en
[SECURITY.md](../../SECURITY.md#supported-versions), específicamente para vulnerabilidades.

**Desde 1.0, esto es un compromiso y no una intención.** Una línea soportada
cada vez, más la minor anterior durante **seis meses** desde el día en que sale
su sucesora. Correcciones de seguridad y de corrección por igual; una funcionalidad no recibe backport.

Lo que cuesta: durante seis meses después de cada minor, dos líneas necesitan
un camino de publicación, y una corrección en `main` también hay que evaluarla
frente a la minor anterior. Si eso deja de ser sostenible, lo honesto es
cambiar este párrafo en una versión y decirlo en Breaking, no dejarlo en silencio.

**Node.js.** `package.json` declara `>=22` y CI prueba Node 22 y 24 en Linux
y Windows —el mínimo y la LTS actual, para que una rotura en cualquiera de los
extremos aparezca— y Node 24 en macOS, cuyos runners son demasiado escasos para ambos. Los jobs que se ejecutan una vez —lint, empaquetado, publicación, el sitio—
y la imagen Docker usan Node 24. Subir el mínimo es **breaking** para la CLI, nunca una minor
silenciosa: una invocación de `npx` que funcionaba y ahora se niega a ejecutarse es breaking,
la llame como la llame el changelog.

El mínimo pasó de 20 a 22 en agosto de 2026, porque Node 20 salió del
mantenimiento LTS ese abril y probar contra un runtime sin soporte no demuestra
nada. La regla desde entonces: **el mínimo es una LTS mantenida.** Cuando una
sale de mantenimiento, el mínimo se mueve en la siguiente versión, y el changelog lo dice en Breaking.

**Docker.** Las imágenes se etiquetan `X.Y.Z` y `latest`, para `linux/amd64` y
`linux/arm64`. Mientras `publish-docker.yml` está desactivado, `latest` es la
imagen más reciente que se construyó —**0.17.10**—, no la versión más reciente
de npm. Un tag publicado nunca se reconstruye en el sitio: volver a ejecutar un
workflow contra un tag antiguo hace checkout del workflow *tal como estaba en
ese tag*. Fija `X.Y.Z` en CI.

## Ventanas de compatibilidad

Tres números de versión viajan con un proyecto, y se comprueban, no solo se
registran. Los dos gates de abajo se añadieron al descubrir que la CLI escribía los campos y nada los leía.

| Campo | Dónde | Esta CLI soporta | Si no coincide |
| --- | --- | --- | --- |
| `schema_version` | `pack.yaml` | hasta **1.5.0** | Un pack que declara un esquema más nuevo se rechaza con el motivo y el comando para actualizar |
| `specops_version` | `.specops.lock` | **1** | Un lockfile de una CLI más nueva se rechaza al leerlo |
| `version` del pack | `.specops.lock` | cualquiera | Fijada; un cambio del digest de contenido hace fallar el build — ver [cadena de suministro](supply-chain.md) |

**Lo antiguo siempre se puede leer.** Un pack con un esquema anterior, o un
lockfile sin `specops_version`, funciona sin cambios: esos archivos son
anteriores al campo, y rechazarlos dejaría tirados proyectos existentes para
imponer una regla inventada después. Solo se rechaza *lo más nuevo que esta
CLI*, porque `schemas/pack.schema.json` fija `additionalProperties: false`:
aquí una minor más nueva es realmente ilegible, no solo desconocida. Fallar
arriba con «actualiza la CLI» es mejor que fallar veinte líneas más abajo con «unknown property».

**Subir el esquema de packs** es una publicación en dos pasos, en este orden:

1. Publica la CLI que entiende el nuevo esquema: sube `PACK_SCHEMA_VERSION`
   en `packages/core/src/domain/PackSpec.ts` en el mismo change que el campo.
2. Solo entonces publica packs que lo usen.

Invierte el orden y todos los packs publicados dejan de poder instalarse con la
CLI publicada. Un test unitario afirma que ningún pack de `packs/` declara un
esquema más nuevo que el que soporta la CLI, así que hacerlo al revés hace fallar CI en lugar de a los usuarios.

## Publicar una versión

1. Actualiza `CHANGELOG.md`. Cada cambio visible para el usuario lleva una
   línea; agrupa por Added / Changed / Fixed / Removed.
2. Sube `version` en `package.json`, y luego `npm run build && npm run plugin:sync`
   para que los tres manifiestos del plugin la lleven (un test falla hasta que lo hagan).
3. Vuelve a grabar el terminal de la landing: `npm run build && npm run docs:terminal`,
   que reescribe el `version` de `docs/assets/terminal-*.json`. La grabación
   lleva la versión con la que se hizo y un test compara ambas, así que
   saltarse esto hace fallar el build en lugar de publicar una página que
   afirma la versión equivocada.
4. Sube cada página que fija la versión —`grep -rn "<old version>" docs` las
   encuentra—: las landings (cabecera, eyebrow, «Recorded from», pie); los
   ejemplos de CI `npx …@X.Y.Z` en `gate/ci.md`, `validating.md` y
   `existing-project-with-jira.md`; la imagen Docker en `gate/local.md` y
   `automation.md`; las gemelas en español; y `specgate --version` en `tutorial.md`.
   Deja en paz el `schema_version` del esquema de packs: solo se mueve con
   `PACK_SCHEMA_VERSION`, no con una versión.
5. Comprueba que la versión se examinó con las herramientas de agente reales:
   `specgate compat check-release` falla con `compat_not_examined` hasta que el
   examen de compatibilidad ejecutó esta versión (`specgate compat run --level L0 --task deliver`).
6. Abre un PR a **`develop`** —nunca directamente a `main`, que está protegida—:
   deben pasar los doce [checks obligatorios](../../CONTRIBUTING.md#required-checks).
7. Haz merge en `develop`, espera a CI en el propio `develop` y luego haz
   fast-forward de `main` hasta él. Una versión se corta desde un `main` que ha
   estado en verde todo el camino, no desde uno que estuvo en rojo los veinte minutos que se tardó en notarlo.

   Tres de los checks obligatorios de `main` (`npm audit`, `CodeQL`, `SBOM and
   licences`) solo se ejecutan en pull requests, así que abre primero un PR
   `develop → main`: los ejecuta todos sobre el commit de la versión. Luego haz push de ese commit exacto:

   ```bash
   git push origin <release-sha>:refs/heads/main   # fast-forward only, never --force
   ```

   **Pon el refspec entre comillas: `"${R}:refs/heads/main"`.** En zsh,
   `$R:refs/…` aplica el modificador `:r` y deja de nombrar el commit. Lee la salida.
8. **Solo cuando `git rev-parse origin/main` sea el commit de la versión**,
   etiquétalo `vX.Y.Z` y haz push del tag. En 0.10.0 el tag salió mientras el
   push a `main` había fallado. `publish-npm.yml` se dispara, y solo publica
   cuando el workflow E2E pasa en las tres plataformas.
9. Escribe las notas de la versión en GitHub a partir de la entrada del changelog.
10. Ejecuta el E2E contra lo que sirve el registro:
   `curl -sfLO https://registry.npmjs.org/@rsaglobaltech/specgate/-/specgate-X.Y.Z.tgz && npm run e2e -- --tarball specgate-X.Y.Z.tgz`.
   La CDN puede responder 404 durante unos minutos cuando `dist-tags` ya
   indica la nueva versión; espera, no vuelvas a publicar.

## Cómo se hace una versión hoy

CI ejecuta el gate en el pull request de la rama de la versión; el mantenedor
puede ejecutarlo también en local (WSL para Linux) y luego etiqueta. Así salió 0.27.4:

1. **Ejecuta todo lo que ejecutarían los workflows**, en la rama de la versión:

   ```bash
   npm run build && npm run test:all       # the gate publish-npm.yml runs
   npm run lint && npm run format:check
   npm run docs:terminal:check && npm run docs:journey:check
   npm run pack:dry-run
   node e2e/run.mjs                        # the E2E the npm workflow gates on
   ```

2. **Changelog, versión, grabaciones, páginas fijadas, el examen de
   compatibilidad**: los pasos 1–5 de [Publicar una versión](#publicar-una-version).
3. **`develop`, luego `main`**: haz merge en `develop`, abre el pull request
   `develop → main` y luego haz fast-forward de `main` hasta ese commit exacto
   con `git push origin "${R}:refs/heads/main"` (un bypass de admin: solo un commit que ejecutó el paso 1).
4. **Publica**: etiqueta y haz push del tag. Los tres (`publish-npm.yml`,
   `publish-github-packages.yml`, `publish-docker.yml`) se disparan con él:

   ```bash
   git tag -a vX.Y.Z <release-sha> -m "vX.Y.Z"
   git push origin vX.Y.Z
   ```

   El tag ejecuta los recorridos E2E en Linux, macOS y Windows, luego
   `test:all`, y después publica con provenance.
5. **Comprueba el registro.** El job `smoke` de `publish-npm.yml` instala la
   versión desde npm con su dist-tag y ejecuta `--version`, `init` y
   `status` (REQ-572); si su job falla, es una versión publicada que hay que parchear ya.

   Solo npm depende del E2E (Windows incluido): 0.19.0 lo falló después de que
   publicaran los otros dos, así que salió como 0.19.1 (también 0.27.0, como 0.27.1); un tag publicado nunca se reconstruye.

6. **Notas de la versión**: `gh release create vX.Y.Z --notes-file <changelog entry>`.

## Prereleases

Una prerelease (`1.0.0-rc.1`, desde una línea candidata, nunca desde `main`) se
etiqueta como cualquier versión: se publica con el dist-tag `next`, su imagen
se etiqueta solo con la versión, nunca `latest` (REQ-281), y su release de GitHub es `--prerelease`.

## Trusted publishing

`publish-npm.yml` está listo para el trusted publishing de npm (REQ-556): npm
prueba OIDC antes que el secreto `NPM_TOKEN`. Cámbialo una vez, **justo antes de una versión**: un
trusted publisher que no ha publicado en dos días caduca:

1. En npmjs.com, en **Settings → Trusted Publisher → GitHub Actions** del paquete:
   `rsaglobaltech` / `specgate` / `publish-npm.yml`, sin entorno.
2. Etiqueta y haz push de la versión; npmjs.com la muestra construida por `publish-npm.yml`.
3. Borra el secreto `NPM_TOKEN` y las líneas `NODE_AUTH_TOKEN`, y luego en
   **Settings → Publishing access** elige «disallow tokens».

## Antes de etiquetar: el gate

`publish-npm.yml` depende de `npm run test:all` y de un `pack:dry-run`, así que
un tag roto no puede publicarse. Ejecuta antes lo mismo en local: encontrarlo
aquí cuesta un commit; encontrarlo en el workflow cuesta un número de versión:

```bash
npm run verify        # typecheck · eslint · tests · pack dry-run
npm run format:check  # prettier — CI runs it, verify does not
npm run test:all      # every suite, including BDD and the package tests
npm run e2e           # the packed tarball, installed and driven end to end
npm pack --dry-run    # inspect the tarball contents
```

`npm run e2e` (`e2e/run.mjs`) empaqueta este checkout, instala el tarball en un
directorio vacío y ejecuta los recorridos que hace un equipo contra el binario
instalado: adopt, `new` → test → `done --strict`, una matriz desactualizada,
una matriz mantenida a mano migrada, `ci init`, el harness y una actualización
desde la última versión publicada (`--skip-network` deja esa fuera). También
es el workflow `E2E`, en cada pull request y en las tres plataformas, y
**`publish-npm.yml` no publicará un tag si no pasa**.

Comprueba que el tarball lleva lo que lista `files` en `package.json` —`bin/`,
`dist/bin/`, `dist/scripts/`, `dist/packages/core/`,
`dist/packages/mcp-spec-driven/src/`, `templates/`, `examples/`, `vendor/`,
`README.md` y `CHANGELOG.md`— y nada más: ni `.local`, ni `dist/packages/**` de
paquetes no publicados, ni salida de cobertura.

## Después de la versión

Escribe las notas de la versión a partir del changelog, deja un `## [Unreleased]` vacío al principio de `CHANGELOG.md` y abre el siguiente milestone.

## Despliegue del sitio

`pages.yml` es el único workflow que sigue activo: el repositorio es público,
así que no cuesta minutos. Despliega con las acciones de Pages de GitHub (sin rama `gh-pages`) en cada push a `main`
que toque cualquiera de `docs/**`, `packs/**`, `packages/pack-registry/**`,
`scripts/docs/**`, `package.json`, `schemas/**`, `.github/workflows/pages.yml`
o `README.md`: una corrección de cómo se renderiza el sitio no cambia ningún archivo de `docs/`.
También se puede ejecutar a mano (`workflow_dispatch`).

Una ejecución compila el TypeScript y luego escribe en `_site/`:

1. **El sitio de documentación**: `node dist/scripts/docs/build-site.js --out _site`
   renderiza cada página de `docs/` y copia la landing y los recursos.
2. **El propio informe de cobertura de este repositorio**: `/report.html`, de
   `specgate report`, una instantánea del último despliegue.
3. **El registro de packs**: `/packs/index.html` y `/packs/manifest.json`,
   de cada pack de `packs/`.

### Dominio propio

Para servirlo desde un dominio propio como `packs.spec-driven.dev`:

1. **Añade una variable del repositorio** llamada `SITE_CNAME` con el dominio
   (Settings → Secrets and variables → Actions → Variables). El workflow solo
   escribe un archivo `CNAME` cuando la variable existe, así que el despliegue
   es seguro antes de configurar el dominio.
2. **Apunta el DNS** a GitHub Pages; ver
   <https://docs.github.com/pages/configuring-a-custom-domain-for-your-github-pages-site>.
3. **Activa HTTPS** en Settings → Pages cuando se emita el certificado.
4. **Vuelve a ejecutar el workflow** para que se publique el archivo `CNAME`.

### Vista previa en local

```bash
npm run build
node dist/scripts/docs/build-site.js --out _site            # without --out it writes ./_site
node dist/packages/pack-registry/src/build.js --out _site/packs
npx serve _site                                             # http://localhost:3000/ — delete _site/ after
```

### Verificar un despliegue

```bash
curl -sI https://rsaglobaltech.github.io/specgate/packs/manifest.json | head -1
# expect: HTTP/2 200
curl -s  https://rsaglobaltech.github.io/specgate/packs/manifest.json | jq '.packs | length'
# expect: as many packs as packs/ holds — find packs -name pack.yaml | wc -l
```
