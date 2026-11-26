<!-- translation-of: c69e9de1fe73 -->
# Referencia de la CLI

```text
forja init [name] [options]
forja add usecase <module/Name> [options]
forja add entity <[module/]Name> [options]
forja add port <[module/]Name> [options]
forja doctor
forja --version
forja --help
```

`forja <command> --help` imprime las opciones de cada comando.

## forja init

Crea un proyecto nuevo en `./<name>`. Sin opciones lanza el asistente; con `--yes` o `--config` no
pregunta nada.

| Opción | Valores | Notas |
| --- | --- | --- |
| `[name]` | letras minúsculas, dígitos y guiones, empezando por una letra | Obligatorio con `--yes`. También da nombre a la carpeta, al scope `@<name>` y al paquete Java predeterminado. |
| `--backend <backend>` | `node`, `spring`, `quarkus` | Por defecto `node`. Elige el conjunto de valores predeterminados con `--yes`; con `--config`, sustituye el del fichero. Cualquier otro valor se detiene con `Unknown backend`. |
| `--java-package <pkg>` | p. ej. `com.acme.shop` | Solo Java. Por defecto `com.<name>` sin guiones. |
| `--archunit` / `--no-archunit` | | Solo Java. ArchUnit está activado por defecto en Java. Se ignora en Node. |
| `--platforms <list>` | `web`, `mobile`, separados por comas | Por defecto en Node `web,mobile`. Java: `web`, o `""` para solo una API. |
| `--db <db>` | `postgres-docker`, `none` | Por defecto `postgres-docker`. |
| `--auth <auth>` | `sessions` (Node), `oauth2` (Java), `none` | Por defecto `sessions` en Node y `oauth2` en Java. |
| `--mailer <mailer>` | `console` | Lo usan las sesiones de Node para los emails de restablecer contraseña. |
| `--design <design>` | `tailwind`, `none` | Por defecto `tailwind`. |
| `--tests <list>` | `unit`, `integration`, `e2e-web` | Por defecto `unit,integration`. La lista sustituye a la predeterminada. |
| `--extras <list>` | `lint`, `ci`, `docker`, `specgate` | Por defecto en Node `lint`; en Java `lint,docker,specgate`. La lista sustituye a la predeterminada. |
| `--pm <pm>` | `npm`, `pnpm`, `bun` | Por defecto `npm`. Los backends Java usan solo `npm`. |
| `--yes` | | No preguntar nada: los valores predeterminados más los flags. |
| `--config <path>` | un `forja.config.json` | Partir de ese fichero; el nombre y los flags lo sobrescriben. Consulta [Configuración](config.md). |
| `--dry-run` | | Imprimir el árbol de ficheros y no escribir nada. |
| `--skip-install` | | No instalar las dependencias (y por tanto no adoptar Specgate). |
| `--skip-git` | | No ejecutar `git init` ni hacer el primer commit. |

### Qué hace `init`, en orden

1. Construye la configuración a partir del asistente, de `--yes` y los flags, o de `--config` y los
   flags.
2. La valida. Una configuración inválida se detiene aquí, antes de escribir nada.
3. Genera cada fichero en memoria y después formatea con Prettier los ficheros `.ts`, `.tsx`, `.js`,
   `.jsx`, `.json`, `.css` y `.md`.
4. Con `--dry-run`, imprime el árbol y se detiene.
5. Se niega si `./<name>` existe y no está vacía.
6. Escribe los ficheros.
7. Salvo que se omita (y, en el asistente, tras preguntar): `git init -b main` con un primer commit
   `chore: scaffold with forja`, después la instalación con el gestor de paquetes elegido y después la
   adopción de Specgate cuando ese extra está activado.
8. Imprime los siguientes pasos.

### Combinaciones rechazadas

Cada una de estas detiene `init` con `That configuration is not valid:` seguido de una línea por
problema:

| Combinación | Mensaje |
| --- | --- |
| Node sin ninguna plataforma | `platforms: Choose at least one platform` |
| Java con `mobile` | `platforms: mobile with a Java backend is not supported yet: use --platforms web, or none for an API only` |
| Java con `--auth sessions` | `auth: with a Java backend, auth is oauth2 or none` |
| Node con `--auth oauth2` | `auth: auth oauth2 needs a Java backend (spring or quarkus)` |
| Node con `--java-package` | `javaPackage: --java-package needs a Java backend (spring or quarkus)` |
| Node con el extra `docker` | `extras: docker is for Java backends; a Node project gets docker-compose with --db postgres-docker` |
| `e2e-web` sin `web` | `tests: e2e-web tests the web app: add web to the platforms` |
| `mobile` sin `web`, con auth | `platforms: mobile needs web too when there is auth: the auth API lives in apps/web (route handlers)` |
| `archunit: true` en Node (desde un fichero de configuración) | `archunit: --archunit needs a Java backend (spring or quarkus)` |

Un valor fuera de las listas anteriores también se rechaza:

```text
That configuration is not valid:
  db: Invalid enum value. Expected 'postgres-docker' | 'none', received 'mysql'
```

Igual que un nombre o un paquete incorrectos:

```text
  name: Invalid name: use lowercase letters, digits and hyphens
  javaPackage: Invalid Java package: e.g. com.acme.shop
```

Otros errores de `init`:

- `The project needs a name: "forja init <name> --yes"` cuando `--yes` no lleva nombre.
- `"<path>" already exists and is not empty.` cuando la carpeta de destino tiene ficheros.

Todos salen con código 1.

## forja add

Añade una pieza del hexágono al proyecto en el que estás. [Uso diario](daily-use.md) muestra dónde
acaba cada fichero.

| Comando | Argumento | Qué añade |
| --- | --- | --- |
| `forja add usecase` | `<module/Name>` | un caso de uso, su test y su cableado |
| `forja add entity` | `<[module/]Name>` | una entidad de dominio y su test. Java necesita el módulo. |
| `forja add port` | `<[module/]Name>` | un puerto de salida y un adaptador en memoria. Java necesita el módulo. |

| Opción | Comandos | Efecto |
| --- | --- | --- |
| `--dry-run` | todos | imprime lo que cambiaría, no escribe nada |
| `--req <id>` | `usecase` | nombra este requisito existente (`REQ-007`) en el test |
| `--title <title>` | `usecase` | el título del requisito, cuando Specgate lo crea |
| `--no-spec` | `usecase` | no crea un requisito en Specgate |
| `--no-adapter` | `port` | solo el puerto, sin adaptador en memoria |

Errores, cada uno con la corrección en la línea de abajo:

| Situación | Mensaje |
| --- | --- |
| Falta el módulo donde hace falta uno | `"PlaceOrder" needs its module: a use case lives in application/<module>/.` (Node) o `every class lives in one module of apps/api.` (Java) |
| Un nombre vacío, o más de una `/` | `"a/b/C" is not a name.` |
| El nombre no empieza por una letra | `"..." does not give a valid class name.` |
| Un nombre de módulo incorrecto | `"..." is not a valid module name.` |
| Un `--req` que no es `REQ-<digits>` | `"..." is not a requirement id.` |
| Un fichero ya existe | `<path> already exists.` |
| Fuera de un proyecto | `No forja.config.json here or in any parent directory.` |
| Un `forja.config.json` inválido | `forja.config.json is not valid:` y una línea por problema |

Salen con código 1. Consulta [forja y Specgate](specgate.md) para `--req`, `--title` y `--no-spec`.

## forja doctor

```bash
forja doctor
```

Sin opciones. Comprueba las herramientas, los ficheros `.env` y las reglas de arquitectura del proyecto
en el que estás, y sale con código 1 cuando falla una comprobación. [Uso diario](daily-use.md#forja-doctor)
lista cada comprobación.

## forja --version

`forja --version` (o `-v`) imprime la versión instalada.
