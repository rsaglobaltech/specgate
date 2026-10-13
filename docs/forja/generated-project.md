# The generated project

forja builds a project from recipes. Each recipe writes one concern: the API, the web app, the database,
auth, an extra. The configuration decides which recipes run, and in which order. This page goes through
them one by one. Run `forja init <name> --yes --dry-run` with your flags to see the exact tree.

## Node recipes

They run in this order: `base`, `shared`, `core-hexagonal`, `db-postgres-docker` or `db-none`, `web`,
`mobile`, `auth-sessions` or `auth-none`, `mailer-console`, `design-tailwind`, `e2e-web`,
`extras-lint`, `ci`, `specgate`. Each one runs only when the configuration asks for it.

| Recipe | Runs when | Writes |
| --- | --- | --- |
| `base` | always | root `package.json` (npm workspaces `apps/*`, `packages/*`; `test` and `typecheck` across them), `tsconfig.base.json`, `.gitignore`, `.editorconfig`, `README.md`, `docs/architecture.md`, `forja.config.json` |
| `shared` | always | `packages/shared`: API types and zod validation shared by web and mobile |
| `core-hexagonal` | always | `packages/core`: domain, auth use cases, ports, in-memory adapters, bcrypt, clock, logger, `container.ts`, `env.ts`; unit tests with `unit` |
| `db-postgres-docker` | `db: postgres-docker` | `docker-compose.yml` (PostgreSQL 16), `drizzle.config.ts`, the Drizzle schema and repositories, `db:push` and `db:studio` scripts, `DATABASE_URL` |
| `db-none` | `db: none` | nothing: the in-memory repositories are enough |
| `web` | `web` in platforms | `apps/web`: Next.js App Router, layout, home page; root `dev` and `build` scripts |
| `mobile` | `mobile` in platforms | `apps/mobile`: Expo Router, `app.config.ts`, Babel and Metro config; root `mobile` script; `EXPO_PUBLIC_API_URL` |
| `auth-sessions` | `auth: sessions` | web: login, register, forgot and reset password pages, Server Actions, `proxy.ts`, a dashboard; with mobile, the `/api/auth/*` route handlers and the mobile screens; integration tests with `integration`; `SESSION_TTL_DAYS` |
| `auth-none` | `auth: none` | nothing |
| `mailer-console` | auth is not `none` | `ConsoleMailer` and `InMemoryMailer` in `packages/core` |
| `design-tailwind` | `design: tailwind` | design tokens in `packages/shared/src/design`; Tailwind 4 on the web; NativeWind with Tailwind 3 on mobile |
| `e2e-web` | `e2e-web` in tests | Playwright in `apps/web`; see [End-to-end tests](e2e.md) |
| `extras-lint` | `lint` in extras | `eslint.config.mjs`, `.prettierrc.json`, a `lint` script |
| `ci` | `ci` in extras | `.github/workflows/ci.yml` |
| `specgate` | `specgate` in extras | `docs/brief.md`, `docs/specgate.md`, the Specgate dependency and scripts; see [forja and Specgate](specgate.md) |

The environment variables the recipes declare are collected in one root `.env.example`, grouped by
recipe: `APP_URL`, `DATABASE_URL`, `SESSION_TTL_DAYS` and `EXPO_PUBLIC_API_URL`, depending on the
choices.

### The Node tree

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

## Java recipes

They run in this order: `base`, `api-spring` or `api-quarkus`, `compose`, `keycloak`, then with a web
app `shared`, `web-java`, `design-tailwind` and `e2e-web`, and last the extras in the order you listed
them: `extras-lint` (with a web app only), `ci`, `docker-java`, `specgate`.

| Recipe | Runs when | Writes |
| --- | --- | --- |
| `base` | always | root `package.json` with `dev:api`, `test:api` and, with web, `dev:web`, `test:web`; `README.md`, `docs/architecture.md`, `.gitignore`, `forja.config.json` |
| `api-spring` / `api-quarkus` | the backend | `apps/api`: Maven Wrapper, `pom.xml`, the `shared` and `tasks` modules, tests; the PostgreSQL or in-memory adapter; the OAuth2 or no-auth security; `ArchitectureTest` with `archunit` |
| `compose` | `db: postgres-docker` or `auth: oauth2` | `docker-compose.yml` with PostgreSQL 17 and/or Keycloak 26.8 |
| `keycloak` | `auth: oauth2` | `infra/keycloak/<name>-realm.json` |
| `shared` | `web` in platforms | `packages/shared`: the API's types for the web app |
| `web-java` | `web` in platforms | `apps/web`: Next.js 16, the tasks pages, a server-only API client; with OAuth2, Auth.js and its route; `.env.example` and a ready `.env.local` |
| `design-tailwind` | web and `design: tailwind` | Tailwind 4 and design tokens |
| `e2e-web` | web and `e2e-web` in tests | Playwright in `apps/web` |
| `extras-lint` | web and `lint` in extras | ESLint and Prettier for the TypeScript side |
| `ci` | `ci` in extras | `.github/workflows/ci.yml` with an `api` job (`./mvnw -B verify`) and a `web` job |
| `docker-java` | `docker` in extras | `apps/api/Dockerfile` and `.dockerignore`; with web, `apps/web/Dockerfile` |
| `specgate` | `specgate` in extras | as on Node |

[Java backends](java.md) shows the Java tree and how to run it.

## Versions

The versions forja pins, as written in the recipes and templates:

| Piece | Version |
| --- | --- |
| Next.js | `^16.4.0` |
| React (Node path: root, web and mobile) | `19.2.3`, the version Expo SDK 57 pins |
| React (Java web app) | `^19.3.0` |
| Expo SDK | `~57.0.28`, with React Native `0.86.3` and Reanimated `4.5.1` |
| TypeScript (Node path) | `~6.0.3` |
| TypeScript (Java web app) | `^5.9.3` |
| zod / vitest | `^4.6.7` / `^5.0.4` |
| Drizzle ORM / drizzle-kit / postgres.js | `^0.45.4` / `^0.31.11` / `^3.4.9` |
| Tailwind (web) / NativeWind with Tailwind (mobile) | `^4.3.3` / `^4.2.7` with `^3.4.17` |
| ESLint / Prettier | `^10.12.0` / `^3.6.2` |
| Auth.js (`next-auth`) | `5.0.0-beta.32` |
| Playwright | `~1.63.0` |
| Spring Boot / springdoc | `4.1.1` / `3.1.1` |
| Quarkus | `3.40.1` |
| ArchUnit | `1.5.1` |
| Java | 21 |
| PostgreSQL image | `16-alpine` (Node), `17-alpine` (Java) |
| Keycloak image | `26.8` |
| Specgate | `^0.19.1` |

## How it is written

Recipes write to an in-memory file system. When all of them have run, forja formats the TypeScript,
JavaScript, JSON, CSS and Markdown files with Prettier, and only then writes to disk. A failure part
way through leaves nothing behind, and `--dry-run` prints that same in-memory tree.

[Contributing](contributing.md) explains how a recipe is written.
