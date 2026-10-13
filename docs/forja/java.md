# Java backends

With `--backend spring` or `--backend quarkus`, forja puts the logic in a Java API in `apps/api` and
makes the Next.js web app a client of that API. The API is hexagonal, with one package per module, and
ships with a sample `tasks` module whose domain and application layers are plain Java.

| | Spring Boot | Quarkus |
| --- | --- | --- |
| Version | 4.1.1 | 3.40.1 |
| Java | 21 | 21 |
| Build | Maven Wrapper (`apps/api/mvnw`) | Maven Wrapper (`apps/api/mvnw`) |
| Persistence | JDBC + Flyway + PostgreSQL | JDBC (Agroal) + Flyway + PostgreSQL |
| Real PostgreSQL in tests | Testcontainers | Dev Services |
| OpenAPI UI | `/swagger-ui.html` | `/q/swagger-ui` |
| Health | `/actuator/health` | `/q/health` |
| Config file | `application.yml` | `application.properties` |

## Create one

```bash
forja init shop --yes --backend spring
forja init shop --yes --backend quarkus
```

The wizard asks the same things in order: the root Java package, ArchUnit, a web app, the database,
authentication, the design system, end-to-end tests and the extras.

The Java defaults with `--yes`: a web app, PostgreSQL in Docker, OAuth2 with Keycloak, ArchUnit on,
Tailwind, unit and integration tests, and the `lint`, `docker` and `specgate` extras. CI is never on by
default; add it with `--extras lint,docker,specgate,ci` if you want a GitHub Actions workflow.

### The Java package

The root package defaults to `com.<name>`, with hyphens removed: `forja init my-shop` gives
`com.myshop`. Choose your own with `--java-package`:

```bash
forja init shop --yes --backend spring --java-package com.acme.shop
```

It must have at least two segments of lowercase letters, digits and underscores.

### API only

Pass an empty platform list and forja skips the web app, `packages/shared` and the web Dockerfile:

```bash
forja init shop --yes --backend quarkus --platforms ""
```

Mobile is not available with a Java backend yet; `--platforms web,mobile` is rejected.

## What you get

```text
apps/api/
  src/main/java/com/shop/
    shared/                     DomainException, CurrentUser, Problem Details, security, clock
    tasks/
      domain/                   Task, TaskId, TaskTitle, TaskNotFound: plain Java
      application/              CreateTask, CompleteTask, ListMyTasks
      application/port/         TaskRepository
      infrastructure/config/    TasksConfiguration: wires the use cases
      infrastructure/persistence/  JdbcTaskRepository (InMemory with --db none)
      infrastructure/web/       TaskController (Spring) or TaskResource (Quarkus)
  src/main/resources/db/migration/V1__tasks.sql
  src/test/java/com/shop/       TaskTest, TaskUseCasesTest, TaskApiTest, StartupTest, ArchitectureTest
apps/web/                       Next.js 16 + Auth.js, server-side API client
packages/shared/                the API's types for the web app
infra/keycloak/shop-realm.json  development realm
docker-compose.yml              PostgreSQL + Keycloak
```

## Run it

```bash
cd shop
docker compose up -d     # PostgreSQL + Keycloak (demo / demo)
npm install
npm run dev:api          # http://localhost:8080
npm run dev:web          # http://localhost:3000
```

The root `package.json` drives both sides:

| Script | Runs |
| --- | --- |
| `npm run dev:api` | `cd apps/api && ./mvnw spring-boot:run` (Spring) or `./mvnw quarkus:dev` (Quarkus) |
| `npm run dev:web` | `next dev` in `apps/web` |
| `npm run test:api` | `cd apps/api && ./mvnw -q -B verify` |
| `npm run test:web` | type-checks the workspaces and builds `apps/web` |
| `npm test` | `test:api`, then `test:web` (only `test:api` for an API-only project) |

The web app's settings are in `apps/web/.env.local`, which forja writes ready to use with a random
`AUTH_SECRET`. `apps/web/.env.example` documents the same keys.

If port 5432 is taken, `DB_PORT=5440 docker compose up -d` moves PostgreSQL, and the Spring API reads
the same `DB_PORT`. In dev mode, Quarkus starts its own PostgreSQL through Dev Services; its
`DB_URL`, `DB_PORT`, `DB_USER` and `DB_PASSWORD` settings apply to the production profile.

## OAuth2 with Keycloak

With `--auth oauth2` (the default), the pieces fit together like this:

- The API is an OAuth2 resource server. It validates the JWT and takes the current user from the
  token's `sub`, behind the `CurrentUser` port. Another user's task answers 404.
- The web app signs in with Auth.js through Authorization Code + PKCE. It keeps the tokens in its
  encrypted session cookie and calls the API from the server with the access token, so the token
  never reaches the browser. Sign-out is federated.
- `docker compose` runs a development Keycloak on `http://localhost:8180` that imports
  `infra/keycloak/<name>-realm.json`: a `web` client for Auth.js, a `dev-cli` client, and two users,
  `demo` / `demo` and `other` / `other`. The admin console uses `admin` / `admin`.

To call the API by hand, ask Keycloak for a token with the `dev-cli` client:

```bash
curl -s -d grant_type=password -d client_id=dev-cli -d username=demo -d password=demo \
  http://localhost:8180/realms/shop/protocol/openid-connect/token | jq -r .access_token
```

With `--auth none`, there is no Keycloak and the API uses a fixed local user.

## Errors, OpenAPI and health

Errors come out as RFC 9457 Problem Details (`application/problem+json`) with a stable `code`, such as
`task_not_found`. Clients decide on the `code`, not on the message. OpenAPI and a health endpoint are on
from the start.

## Tests

| Test | What it proves |
| --- | --- |
| `TaskTest` | the domain rules, with no framework |
| `TaskUseCasesTest` | the use cases, with in-memory doubles |
| `TaskApiTest` | the HTTP API end to end, against a real PostgreSQL |
| `StartupTest` | the real application boots with its real pieces, no doubles |
| `ArchitectureTest` | the hexagonal rules (with ArchUnit on) |

With `--db postgres-docker`, the API tests need Docker running: Spring uses Testcontainers and Quarkus
uses Dev Services. With `--db none`, they use the in-memory adapter.

### ArchUnit

ArchUnit is on by default. `--no-archunit` leaves `ArchitectureTest` out. The rules it checks are listed
in [Architecture](architecture.md#what-archunit-checks).

## Production Dockerfiles

The `docker` extra writes `apps/api/Dockerfile` (multi-stage, running as an unprivileged user) and,
with a web app, `apps/web/Dockerfile` for a standalone Next.js build.

## Next

- [Daily use](daily-use.md): `forja add` puts new classes in the right module and wires them in
  `<Module>Configuration`.
- [End-to-end tests](e2e.md): Playwright through Keycloak and the real API.
