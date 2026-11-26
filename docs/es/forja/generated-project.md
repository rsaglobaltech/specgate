<!-- translation-of: 682db084c879 -->
# El proyecto generado

forja construye un proyecto a partir de recetas. Cada receta escribe una preocupación: la API, la app
web, la base de datos, la autenticación, un extra. La configuración decide qué recetas se ejecutan y en
qué orden. Esta página las recorre una a una. Ejecuta `forja init <name> --yes --dry-run` con tus flags
para ver el árbol exacto.

## Recetas Node

Se ejecutan en este orden: `base`, `shared`, `core-hexagonal`, `db-postgres-docker` o `db-none`, `web`,
`mobile`, `auth-sessions` o `auth-none`, `mailer-console`, `design-tailwind`, `e2e-web`,
`extras-lint`, `ci`, `specgate`. Cada una se ejecuta solo cuando la configuración la pide.

| Receta | Se ejecuta cuando | Escribe |
| --- | --- | --- |
| `base` | siempre | `package.json` raíz (workspaces de npm `apps/*`, `packages/*`; `test` y `typecheck` sobre todos), `tsconfig.base.json`, `.gitignore`, `.editorconfig`, `README.md`, `docs/architecture.md`, `forja.config.json` |
| `shared` | siempre | `packages/shared`: tipos de la API y validación zod compartidos por web y móvil |
| `core-hexagonal` | siempre | `packages/core`: dominio, casos de uso de autenticación, puertos, adaptadores en memoria, bcrypt, reloj, logger, `container.ts`, `env.ts`; tests unitarios con `unit` |
| `db-postgres-docker` | `db: postgres-docker` | `docker-compose.yml` (PostgreSQL 16), `drizzle.config.ts`, el esquema y los repositorios Drizzle, los scripts `db:push` y `db:studio`, `DATABASE_URL` |
| `db-none` | `db: none` | nada: los repositorios en memoria bastan |
| `web` | `web` en platforms | `apps/web`: Next.js App Router, layout, página de inicio; scripts raíz `dev` y `build` |
| `mobile` | `mobile` en platforms | `apps/mobile`: Expo Router, `app.config.ts`, configuración de Babel y Metro; script raíz `mobile`; `EXPO_PUBLIC_API_URL` |
| `auth-sessions` | `auth: sessions` | web: páginas de login, registro, contraseña olvidada y restablecimiento, Server Actions, `proxy.ts`, un dashboard; con móvil, los route handlers `/api/auth/*` y las pantallas móviles; tests de integración con `integration`; `SESSION_TTL_DAYS` |
| `auth-none` | `auth: none` | nada |
| `mailer-console` | auth no es `none` | `ConsoleMailer` e `InMemoryMailer` en `packages/core` |
| `design-tailwind` | `design: tailwind` | design tokens en `packages/shared/src/design`; Tailwind 4 en la web; NativeWind con Tailwind 3 en móvil |
| `e2e-web` | `e2e-web` en tests | Playwright en `apps/web`; consulta [Tests end-to-end](e2e.md) |
| `extras-lint` | `lint` en extras | `eslint.config.mjs`, `.prettierrc.json`, un script `lint` |
| `ci` | `ci` en extras | `.github/workflows/ci.yml` |
| `specgate` | `specgate` en extras | `docs/brief.md`, `docs/specgate.md`, la dependencia de Specgate y sus scripts; consulta [forja y Specgate](specgate.md) |

Las variables de entorno que declaran las recetas se reúnen en un único `.env.example` raíz, agrupadas
por receta: `APP_URL`, `DATABASE_URL`, `SESSION_TTL_DAYS` y `EXPO_PUBLIC_API_URL`, según las
elecciones.

### El árbol Node

```text
apps/
  web/            Next.js 16 (built with --webpack), proxy.ts, (auth) and (app) route groups
  mobile/         Expo SDK 57, Expo Router, (auth) and (app) screens, lib/auth.tsx, lib/api.ts
packages/
  core/
    src/domain/          entities/User, value-objects/Email and Password, events, services, shared/Result
    src/application/     auth/: Register, Login, CreateSession, ValidateSession, Logout,
                         RequestPasswordReset, ResetPassword
    src/ports/           IUserRepository, ISessionRepository, IPasswordResetTokenRepository,
                         IPasswordHasher, IMailer, IClock, ILogger
    src/infrastructure/  clock/, config/ (container.ts, env.ts), database/, logging/, mail/, security/
    tests/unit/, tests/integration/
  shared/
    src/api/, src/validation/, src/design/
```

## Recetas Java

Se ejecutan en este orden: `base`, `api-spring` o `api-quarkus`, `compose`, `keycloak`, después, con
app web, `shared`, `web-java`, `design-tailwind` y `e2e-web`, y por último los extras en el orden en que
los listaste: `extras-lint` (solo con app web), `ci`, `docker-java`, `specgate`.

| Receta | Se ejecuta cuando | Escribe |
| --- | --- | --- |
| `base` | siempre | `package.json` raíz con `dev:api`, `test:api` y, con web, `dev:web`, `test:web`; `README.md`, `docs/architecture.md`, `.gitignore`, `forja.config.json` |
| `api-spring` / `api-quarkus` | el backend | `apps/api`: Maven Wrapper, `pom.xml`, los módulos `shared` y `tasks`, tests; el adaptador PostgreSQL o en memoria; la seguridad OAuth2 o sin autenticación; `ArchitectureTest` con `archunit` |
| `compose` | `db: postgres-docker` o `auth: oauth2` | `docker-compose.yml` con PostgreSQL 17 y/o Keycloak 26.8 |
| `keycloak` | `auth: oauth2` | `infra/keycloak/<name>-realm.json` |
| `shared` | `web` en platforms | `packages/shared`: los tipos de la API para la app web |
| `web-java` | `web` en platforms | `apps/web`: Next.js 16, las páginas de tareas, un cliente de API solo de servidor; con OAuth2, Auth.js y su ruta; `.env.example` y un `.env.local` listo |
| `design-tailwind` | web y `design: tailwind` | Tailwind 4 y design tokens |
| `e2e-web` | web y `e2e-web` en tests | Playwright en `apps/web` |
| `extras-lint` | web y `lint` en extras | ESLint y Prettier para la parte TypeScript |
| `ci` | `ci` en extras | `.github/workflows/ci.yml` con un job `api` (`./mvnw -B verify`) y un job `web` |
| `docker-java` | `docker` en extras | `apps/api/Dockerfile` y `.dockerignore`; con web, `apps/web/Dockerfile` |
| `specgate` | `specgate` en extras | como en Node |

[Backends Java](java.md) muestra el árbol Java y cómo ejecutarlo.

## Versiones

Las versiones que fija forja, tal como están escritas en las recetas y las plantillas:

| Pieza | Versión |
| --- | --- |
| Next.js | `^16.4.0` |
| React (camino Node: raíz, web y móvil) | `19.2.3`, la versión que fija Expo SDK 57 |
| React (app web Java) | `^19.3.0` |
| Expo SDK | `~57.0.28`, con React Native `0.86.3` y Reanimated `4.5.1` |
| TypeScript (camino Node) | `~6.0.3` |
| TypeScript (app web Java) | `^5.9.3` |
| zod / vitest | `^4.6.7` / `^5.0.4` |
| Drizzle ORM / drizzle-kit / postgres.js | `^0.45.4` / `^0.31.11` / `^3.4.9` |
| Tailwind (web) / NativeWind con Tailwind (móvil) | `^4.3.3` / `^4.2.7` con `^3.4.17` |
| ESLint / Prettier | `^10.12.0` / `^3.6.2` |
| Auth.js (`next-auth`) | `5.0.0-beta.32` |
| Playwright | `~1.63.0` |
| Spring Boot / springdoc | `4.1.1` / `3.1.1` |
| Quarkus | `3.40.1` |
| ArchUnit | `1.5.1` |
| Java | 21 |
| Imagen de PostgreSQL | `16-alpine` (Node), `17-alpine` (Java) |
| Imagen de Keycloak | `26.8` |
| Specgate | la versión que fija forja; consulta [forja y Specgate](specgate.md#que-instala-forja) |

## Cómo se escribe

Las recetas escriben en un sistema de ficheros en memoria. Cuando se han ejecutado todas, forja formatea
con Prettier los ficheros TypeScript, JavaScript, JSON, CSS y Markdown, y solo entonces escribe en
disco. Un fallo a mitad de camino no deja nada detrás, y `--dry-run` imprime ese mismo árbol en memoria.

[Contribuir](contributing.md) explica cómo se escribe una receta.
