<!-- translation-of: 98ab605624a3 -->
# Configuración

Todo proyecto que crea forja tiene un `forja.config.json` en su raíz. Registra las decisiones tomadas en
`forja init`, y `forja add` y `forja doctor` lo leen para conocer el backend, el paquete y los extras.
También puedes escribir uno a mano, o copiarlo de otro proyecto, y pasárselo a `forja init
--config`.

## Un ejemplo

Este es el fichero que escribe `forja init shop --yes --backend spring`:

```json forja.config.json
{
  "version": 1,
  "name": "shop",
  "scope": "@shop",
  "platforms": ["web"],
  "backend": "spring",
  "archunit": true,
  "arch": "hexagonal",
  "db": "postgres-docker",
  "auth": "oauth2",
  "mailer": "console",
  "design": "tailwind",
  "ui": "own",
  "edgeFunctions": false,
  "eas": false,
  "tests": ["unit", "integration"],
  "extras": ["lint", "docker", "specgate"],
  "pm": "npm"
}
```

`javaPackage` solo aparece cuando lo defines. `$schema` y `version` los escribe forja y no se vuelven a
leer.

## Campos

| Campo | Tipo | Valores permitidos | Obligatorio |
| --- | --- | --- | --- |
| `name` | string | letras minúsculas, dígitos y guiones, empezando por una letra | sí |
| `scope` | string | `@` seguido de letras minúsculas, dígitos y guiones | sí |
| `platforms` | array | `web`, `mobile` | sí |
| `backend` | string | `node`, `spring`, `quarkus` | no, por defecto `node` |
| `javaPackage` | string | segmentos en minúscula separados por puntos, al menos dos: `com.acme.shop` | no |
| `archunit` | boolean | `true`, `false` | no, por defecto `false` |
| `arch` | string | `hexagonal` | sí |
| `db` | string | `postgres-docker`, `none` | sí |
| `auth` | string | `sessions`, `oauth2`, `none` | sí |
| `mailer` | string | `console` | sí |
| `design` | string | `tailwind`, `none` | sí |
| `ui` | string | `own` | sí |
| `edgeFunctions` | boolean | `false` | sí |
| `eas` | boolean | `false` | sí |
| `tests` | array | `unit`, `integration`, `e2e-web` | sí |
| `extras` | array | `lint`, `ci`, `docker`, `specgate` | sí |
| `pm` | string | `npm`, `pnpm`, `bun` (Java: solo `npm`) | sí |

`arch`, `ui`, `edgeFunctions` y `eas` tienen hoy un único valor aceptado. Reservan el sitio a opciones
que forja todavía no genera, y un fichero escrito a mano debe incluirlas igualmente.

Qué significa cada campo:

- `scope` da nombre a los paquetes internos: `@shop/core`, `@shop/shared`, `@shop/web`.
- `platforms` lista las apps. En Java, `[]` significa solo una API.
- `backend` decide dónde vive la lógica: `packages/core` en TypeScript, o `apps/api` en Java.
- `javaPackage` es el paquete Java raíz. Sin él, forja usa `com.<name>` sin los guiones.
- `archunit` añade el test de ArchUnit en Java.
- `db: none` mantiene los repositorios en memoria; `postgres-docker` añade PostgreSQL en Docker.
- `auth: sessions` es la autenticación por sesiones integrada en Node; `oauth2` es Keycloak y Auth.js en
  Java.
- `mailer: console` imprime los emails en el terminal. Lo usan las sesiones de Node.
- `design: tailwind` añade Tailwind en la web y NativeWind en móvil, con design tokens compartidos.
- `tests` elige las suites de tests; `e2e-web` añade Playwright. Consulta [Tests end-to-end](e2e.md).
- `extras`: `lint` añade ESLint y Prettier, `ci` un workflow de GitHub Actions, `docker` Dockerfiles de
  producción (Java), `specgate` la configuración de Specgate ([forja y Specgate](specgate.md)).
- `pm` es el gestor de paquetes con el que forja instala y que `forja doctor` comprueba.

Se aplican las mismas reglas entre campos que con los flags; la
[referencia de la CLI](cli.md#combinaciones-rechazadas) las lista con sus mensajes.

## Valores predeterminados

`forja init <name> --yes` parte de uno de dos conjuntos de valores predeterminados, elegido por
`--backend`:

| Campo | Node (`defaultConfig`) | Java (`defaultJavaConfig`) |
| --- | --- | --- |
| `scope` | `@<name>` | `@<name>` |
| `platforms` | `["web", "mobile"]` | `["web"]` |
| `backend` | `node` | `spring` o `quarkus` |
| `javaPackage` | sin definir | sin definir, así que `com.<name>` |
| `archunit` | `false` | `true` |
| `arch` | `hexagonal` | `hexagonal` |
| `db` | `postgres-docker` | `postgres-docker` |
| `auth` | `sessions` | `oauth2` |
| `mailer` | `console` | `console` |
| `design` | `tailwind` | `tailwind` |
| `ui` | `own` | `own` |
| `edgeFunctions`, `eas` | `false` | `false` |
| `tests` | `["unit", "integration"]` | `["unit", "integration"]` |
| `extras` | `["lint"]` | `["lint", "docker", "specgate"]` |
| `pm` | `npm` | `npm` |

Ninguno de los dos activa `ci`. Escribe un workflow de GitHub Actions, que gasta minutos de Actions en
un repositorio privado, así que lo pides tú.

## Partir de un fichero

```bash
forja init shop --config forja.config.json
forja init other-shop --config ./shop/forja.config.json --db none
```

forja lee y valida el fichero, y después aplica encima el argumento del nombre y los flags:

- El argumento del nombre sustituye a `name`. Si el `scope` del fichero era `@<nombre antiguo>`, pasa a
  ser `@<nombre nuevo>`; un scope personalizado se mantiene.
- `--platforms`, `--db`, `--auth`, `--mailer`, `--design`, `--tests`, `--extras`, `--pm` y
  `--java-package` sustituyen el valor del fichero. Los flags de lista sustituyen la lista entera.
- `--archunit` y `--no-archunit` se aplican cuando el backend del fichero es Java.
- `--backend` sustituye el `backend` del fichero. El resto del fichero debe encajar con el nuevo backend:
  `auth: sessions` con `--backend spring` se rechaza.

El resultado se valida de nuevo, así que un flag que rompe una regla se informa como cualquier otro.

`--config` no pregunta nada: como `--yes`, instala las dependencias y ejecuta `git init` salvo que pases
`--skip-install` o `--skip-git`.

## Dentro de un proyecto

`forja add` y `forja doctor` buscan `forja.config.json` en el directorio actual y en sus padres, y lo
validan. Si lo editas a mano y rompes una regla, se detienen con `forja.config.json is not valid:` y el
problema. Cambiar un campo no regenera nada; solo cambia lo que `add` y `doctor` dan por supuesto.
