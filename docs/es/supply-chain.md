<!-- translation-of: 5f9fc80397df -->
# Cadena de suministro

Esta página lista lo que Specgate descarga, escribe y envía, y lo que protege
cada una de esas cosas: los domain packs (fijados, con digest y, si quieres,
firmados), las credenciales que usan los comandos de Jira y GitHub, el uso sin
conexión y las dependencias de la propia herramienta.

Un **domain pack** es una dependencia que escribe archivos en tu repositorio:
un conjunto de requisitos y escenarios ya hechos para un dominio de negocio.
Eso lo convierte en la mayor superficie de ataque que tiene esta herramienta.

Para informar de una vulnerabilidad, consulta [SECURITY.md](../../SECURITY.md).

## Qué puede hacer un pack

`specgate specops add` clona el repositorio de un pack en un tag fijado y
renderiza sus plantillas en tu proyecto. Renderizar escribe archivos. No
ejecuta código del pack —no hay hook de instalación, ni script de ciclo de
vida, ni punto de entrada de plugin—, pero un pack malicioso aún puede escribir
un archivo `.feature`, un ADR o una configuración de CI que tu pipeline
ejecutará después.

Trata instalar un pack como tratas añadir una dependencia: desde una fuente en
la que confías, en una versión que fijaste.

## Fijado e integridad

Cada pack instalado queda registrado en `.specops.lock` con su repositorio, su
versión y un **digest de contenido**: un `sha256` sobre el árbol de archivos
del pack, calculado a partir de las rutas relativas POSIX ordenadas y del
contenido de los archivos, así que es estable entre sistemas operativos y
órdenes de clonado.

Reinstalar el mismo `(repo, pack, version)` vuelve a calcular el digest y falla
de forma visible cuando difiere:

```
Pack integrity check failed for payments@v1.2.0:
  locked digest:  sha256:9f2c…
  fetched digest: sha256:41ab…
```

Esa es la firma de un **tag movido**, una historia reescrita o una caché
envenenada: las tres formas en que un número de versión deja de significar una
sola cosa. Un tag de versión es una etiqueta, no una promesa; la promesa es el
digest.

La corrección es manual a propósito. Investiga primero el repositorio del
pack. Si el cambio es legítimo, fija una versión nueva, o borra la copia en
caché y vuelve a ejecutar `specops add` para aceptar el nuevo digest de forma
explícita. Nada se repara solo, porque repararse solo aquí significa aceptar
en silencio un contenido sustituido.

## Deriva en la otra dirección

El digest detecta que el pack cambia bajo una versión fija. `validate
--against-lock` detecta lo contrario: archivos renderizados en tu repositorio
que ya no coinciden con el pack bloqueado.

```bash
specgate validate . --against-lock
```

`specgate ci init` ahora emite este paso para los cuatro proveedores,
condicionado a que exista `.specops.lock`, así que un proyecto sin packs no se
ve afectado. Si generaste tu gate antes de que existiera, vuelve a ejecutar
`ci init --stdout` y copia el paso `Check pack drift`.

## Packs firmados

La verificación de firmas usa GPG a través de git —`git verify-tag`, y como
alternativa `git verify-commit` para workflows sin tags anotados—. Ninguna
dependencia nueva: las organizaciones que firman ya distribuyen las claves con
las herramientas de git.

Es **opcional**, por proyecto:

```yaml
# specops.config.yaml
require_signed_packs: true
```

Con eso activado, un pack sin firmar o que no se puede verificar es un error
que bloquea.

**Está desactivado por defecto, y es a propósito.** Activarlo por defecto
rompería todos los proyectos que instalan un pack cuyos tags no están firmados
—incluidos los dieciocho packs de este repositorio (siete probados, once
ejemplos de partida)—. Un valor por defecto que falla con un uso correcto
enseña a la gente a desactivar el check, lo que es peor que no tenerlo.
Actívalo cuando tu organización firme sus propios packs; es entonces cuando el
check empieza a distinguir algo.

## Redes aisladas y sin conexión

Dos mecanismos independientes, para dos situaciones distintas.

**Una máquina que ya tiene el pack en caché.** Los packs se guardan en caché en
`~/.cache/specgate/packs/<sha256-of-repo>/<version>/`;
`specops add --cache-dir <path>` apunta a otro sitio. Fijar
`SPECGATE_OFFLINE=1` hace que la resolución use la caché y se niegue a salir a
la red:

```bash
SPECGATE_OFFLINE=1 specgate specops add --pack-repo <url> --pack-version v1.2.0 --pack payments
```

Un fallo de caché es un error que nombra el directorio exacto donde buscó, en
lugar de una descarga silenciosa. Úsalo en runners de CI que no deben tener
salida a la red.

**Una red que nunca ha visto el pack.** Exporta el repositorio del pack como
un bundle de git en una máquina conectada, lleva ese único archivo al otro
lado e instala desde él —`specops add` acepta la ruta de un bundle en
cualquier sitio donde acepta una URL—:

```bash
# connected side
specgate pack bundle --repo https://github.com/acme/packs.git --out acme-packs.bundle

# air-gapped side
specgate specops add --pack-repo ./acme-packs.bundle --pack-version v1.2.0 --pack payments
```

El bundle lleva la historia completa y los tags, así que el fijado de
versiones, los digests y la verificación de firmas siguen funcionando. El
transporte no debilita nada del modelo de seguridad.

Vale la pena ensayar ambos caminos antes de necesitarlos. Un procedimiento de
restauración que nunca se ha ejecutado es una esperanza, no un procedimiento.

## Escáneres para tu código

Los [checks de calidad](quality.md) analizan tus dependencias (osv-scanner), tu
código (Semgrep, SpotBugs, SonarQube) y tu historia en busca de secretos
(gitleaks), cada uno en su imagen oficial, fijada. Un check solo acepta
**nombres** de variables de entorno: un valor escrito en `harness.config.yaml`
se rechaza, así que un token nunca acaba en el repositorio. El token de
SonarQube se guarda en `.specgate/sonar.local`, que Specgate añade a
`.gitignore`.

## Credenciales para Jira y GitHub

La mayoría de los comandos nunca tocan una credencial. Los que hablan con
Jira, Azure Boards o GitHub sí, y todos siguen las mismas reglas:

| Comando                                | Llega a                                                                                                    | Credencial                                                                              |
| -------------------------------------- | ---------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| `specgate propose --from-ticket <KEY>` | Jira: lee una incidencia                                                                                   | la variable que nombra `token_env` (y `user_env` para el email de la cuenta)            |
| `specgate alm sync`, `alm pull`        | Tu tracker (Jira, Azure Boards, GitHub Issues): `pull` lee incidencias, `sync` además las crea y las cierra | la variable que nombra `token_env`                                                     |
| `specgate alm pr <change-id>`          | git push a tu remoto; la API de GitHub                                                                     | tus credenciales de git habituales para el push; la variable que nombra `pr.token_env` para la API |

- **Los tokens viven en el entorno, nunca en un archivo.** `alm.config.yaml`
  se sube al repositorio, así que solo guarda los _nombres_ de las variables
  de entorno (`token_env: JIRA_TOKEN`), nunca sus valores. Guarda los valores
  en tu entorno o en el llavero de tu sistema, y en CI como secretos
  enmascarados.
- **Las credenciales solo viajan por https.** `base_url`, y `pr.base_url` para
  un servidor GitHub Enterprise, deben ser direcciones `https://`; Specgate
  rechaza una dirección `http://` sin cifrar, porque el token viajaría en
  claro. Solo un servidor en tu propia máquina (`localhost`) puede usar
  `http://`.
- **Leer una incidencia no escribe nada en Jira.** `--from-ticket` lee una
  incidencia cada vez, solo claves de `project_key`. Un token de Jira creado
  con scopes solo necesita `read:jira-work`, y funciona a través del gateway
  de Atlassian (`cloud_id: auto`).
- **Da a `alm pr` un token de GitHub acotado.** Usa un token fine-grained para
  ese único repositorio, con Pull requests en lectura y escritura. No
  reutilices un token personal amplio, como el que tiene tu GitHub CLI.
- **`alm pr` hace push de una rama.** Hace push de la rama de la incidencia a
  `origin` con tus credenciales de git, y luego abre o actualiza un pull
  request. Nunca hace merge. Con `--no-push` se salta el push, para una rama
  de la que ya hiciste push tú.

Configuración de cada modo: [Desde un ticket de Jira](from-a-ticket.md) y
[Jira y Azure Boards](alm.md).

## Dependencias de esta herramienta

El paquete publicado tiene **cero dependencias de runtime**. Todo lo que hay en
`package.json` es una devDependency, así que nada del árbol de dependencias
llega a los usuarios.

Eso no es lo mismo que inofensivo. Una devDependency comprometida se ejecuta
en CI con un token de publicación al alcance; por eso los workflows del
repositorio ejecutan `npm audit` y CodeQL, Dependabot vigila el árbol, y las
versiones en npm llevan
[provenance](https://docs.npmjs.com/generating-provenance-statements).
`npm audit` bloquea según lo que se publica (`--omit=dev`, nada); la auditoría
de la toolchain se ejecuta al lado como informe, así que un aviso sin versión
corregida todavía se ve sin bloquear cada pull request.

### SBOM

Se genera un SBOM CycloneDX en cada push, cada pull request y cada ejecución
semanal programada, y se conserva 90 días como el artefacto `sbom-cyclonedx`:
así una auditoría puede preguntar «qué había en el árbol ese día» sin
reconstruir un grafo de dependencias histórico. En local:

```bash
npm run sbom        # writes sbom.cyclonedx.json
npm run licenses    # SBOM + the licence policy gate
```

Viene de `npm sbom`, no de un generador de terceros. Añadir una dependencia
para documentar que se tienen pocas dependencias sería un mal trato.

### Política de licencias

`scripts/license_check.ts` hace fallar el build cuando algún componente lleva
una licencia fuera de una lista de términos permisivos permitidos. Las
licencias duales (`MIT OR CC0-1.0`) pasan cuando cualquiera de los lados está
permitido; las expresiones `AND` exigen todos los términos.

El árbol la última vez que se contó esta tabla: 377 componentes, todos
permisivos, ningún copyleft. `npm run licenses` imprime el recuento actual:

| Licencia                                         | Componentes |
| ------------------------------------------------ | ----------: |
| MIT                                              |         288 |
| Apache-2.0                                       |          33 |
| ISC                                              |          27 |
| BSD-3-Clause                                     |           9 |
| BSD-2-Clause                                     |           7 |
| BlueOak-1.0.0                                    |           5 |
| MIT OR CC0-1.0                                   |           3 |
| PSF-2.0 · CC-BY-4.0 · CC-BY-3.0 · CC0-1.0 · 0BSD |     1 cada una |

Vale la pena nombrar las cuatro inusuales, porque «permitimos CC-BY» suena
alarmante sin ellas: `argparse` es PSF-2.0 desde la versión 3 (Python-2.0
antes; ambas son los términos permisivos de la Python Software Foundation:
conservar el aviso, nada más), `caniuse-lite` es CC-BY-4.0 sobre un
**conjunto de datos** de soporte de navegadores, y `spdx-exceptions` /
`spdx-license-ids` son CC-BY-3.0 y CC0-1.0 sobre listas de identificadores de
licencias. Las cuatro son datos o herramientas; ninguna impone obligaciones al
distribuir esta CLI.

Una licencia copyleft no está tanto prohibida como pendiente de decidir:
permitir una en silencio se saltaría la revisión de lo que obliga. Si
necesitas añadir una licencia, añádela a `ALLOWED` en
`scripts/license_check.ts` y explica aquí por qué: la lista permitida y su
justificación van en el mismo change.

## Lo que esto no hace

`specgate validate` es un gate de especificación, no un escáner de seguridad.
Comprueba que los requisitos tienen escenarios, tests y filas de trazabilidad.
No te dirá que tu aplicación tiene un fallo de inyección, y nunca dice que lo
haga.

## Siguiente

- [Desde un ticket de Jira](from-a-ticket.md)
- [Domain packs](domain-packs.md)
