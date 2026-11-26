<!-- translation-of: d6da1f604d96 -->
# Primeros pasos

forja crea un proyecto con un core hexagonal y las apps a su alrededor. En el camino Node obtienes un
monorepo TypeScript con una app web Next.js y una app móvil Expo. En el camino Java obtienes una API
Spring Boot o Quarkus con una app web Next.js como cliente. Esta página recorre el camino Node; la página
[Backends Java](java.md) cubre el otro.

## Requisitos

| Herramienta | Cuándo la necesitas |
| --- | --- |
| Node.js 22 o posterior | Siempre. forja y todo proyecto generado se ejecutan sobre él. |
| npm, pnpm o bun | Siempre. npm es el predeterminado; `--pm` elige otro en Node. |
| Docker | Con `--db postgres-docker` (lo predeterminado en Node), para el PostgreSQL de `docker-compose.yml`. |
| JDK 21 | Solo backends Java. |

## Instalación

forja no está en el registro de npm. Instala la última versión, la 1.0.0, desde su
release de GitHub:

```bash Install
npm install -g https://github.com/rsaglobaltech/forja/releases/download/v1.0.0/rsaglobaltech-forja-1.0.0.tgz
forja --version
```

### Desde Specgate

`specgate init --forja` ejecuta forja por ti y pasa todo lo que va después de
`--forja` a `forja init`. Busca forja en el registro de npm salvo que
`SPECGATE_FORJA_CMD` nombre el comando que hay que ejecutar, así que instala forja como arriba y
haz que Specgate apunte a él:

```bash
SPECGATE_FORJA_CMD=forja npx @rsaglobaltech/specgate@latest init --forja shop --backend spring
```

## Tu primer proyecto, con el asistente

```bash
forja init
```

El asistente pregunta el nombre del proyecto y el backend. Para un proyecto Node pregunta después el
scope de los paquetes internos (`@acme/*`), las plataformas (web, móvil), la base de datos, la
autenticación, el mailer, el sistema de diseño, los tests, los extras y el gestor de paquetes. Solo
ofrece lo que forja sabe generar, así que toda respuesta funciona.

Cuando los ficheros están escritos, hace dos preguntas más: instalar las dependencias ahora, e
inicializar git con un primer commit.

## Tu primer proyecto, con `--yes`

`--yes` no pregunta nada. Toma los valores predeterminados y aplica encima cualquier flag que le des.

```bash
forja init acme --yes
```

En Node los valores predeterminados son web y móvil, PostgreSQL en Docker, sesiones integradas, el mailer
de consola, Tailwind, tests unitarios y de integración, y ESLint con Prettier. [Configuración](config.md)
lista cada valor predeterminado. Un proyecto solo web con repositorios en memoria queda así:

```bash
forja init acme --yes --platforms web --db none
```

Con `--yes`, forja instala las dependencias y ejecuta `git init` sin preguntar. Añade `--skip-install`
o `--skip-git` para dejarte cualquiera de los dos pasos. `--dry-run` imprime el árbol de ficheros y no
escribe nada.

## Los siguientes pasos que imprime

Al terminar, forja imprime los comandos que hay que ejecutar a continuación. Para el proyecto Node
predeterminado:

```bash Next steps
cd acme
docker compose up -d
npm run db:push
npm run dev     # http://localhost:3000/login
npm run mobile  # Expo Go
npm test        # unit + integration
```

Qué hace cada uno:

- `docker compose up -d` arranca PostgreSQL. Solo aparece con `--db postgres-docker`.
- `npm run db:push` crea las tablas a partir del esquema Drizzle de `packages/core`.
- `npm run dev` arranca la app web Next.js. Abre `http://localhost:3000/login`, registra un usuario e
  inicia sesión. El email de restablecer contraseña va al terminal, porque el mailer es el de consola.
- `npm run mobile` arranca Expo. Escanea el código QR con Expo Go en tu móvil. La app móvil inicia sesión
  a través de las rutas de API de la app web, así que mantén `npm run dev` en marcha.
- `npm test` ejecuta con vitest los tests unitarios y de integración de `packages/core`.

Si te saltaste la instalación, la lista empieza por `npm install`. Con el extra `specgate` o
`--tests e2e-web` siguen más líneas; consulta [forja y Specgate](specgate.md) y
[Tests end-to-end](e2e.md).

El core recurre a repositorios en memoria cuando `DATABASE_URL` no está definida, y escribe una línea en
el log que lo dice. La app sigue funcionando; los datos se pierden al reiniciar.

## Qué obtienes

El proyecto Node predeterminado, recortado a las carpetas principales:

```text
acme/
  apps/
    web/                    Next.js 16: pages, Server Actions, auth API routes, proxy.ts
    mobile/                 Expo SDK 57 with Expo Router and NativeWind
  packages/
    core/                   the hexagon, in TypeScript
      src/domain/           entities, value objects, events, Result
      src/application/      use cases (auth/ to start with)
      src/ports/            interfaces: IUserRepository, IMailer, IClock...
      src/infrastructure/   adapters (Drizzle, in-memory, bcrypt, console mailer)
                            and config/container.ts, the composition root
      tests/unit/           domain tests
      tests/integration/    use-case tests against in-memory adapters
    shared/                 types, validation and design tokens shared by web and mobile
  docs/architecture.md
  docker-compose.yml        PostgreSQL
  .env.example
  forja.config.json         the choices forja made, read by forja add and forja doctor
  eslint.config.mjs
  package.json              npm workspaces: apps/*, packages/*
```

[El proyecto generado](generated-project.md) lista los ficheros que escribe cada receta.

## Por dónde seguir

- [Uso diario](daily-use.md): añade casos de uso, entidades y puertos, y comprueba el proyecto con
  `forja doctor`.
- [Backends Java](java.md): la misma idea con Spring Boot o Quarkus.
- [Arquitectura](architecture.md): las reglas que mantiene el código generado, y por qué.
