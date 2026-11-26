<!-- translation-of: ddf0eb804c0b -->
# Backends Java

Con `--backend spring` o `--backend quarkus`, forja pone la lógica en una API Java en `apps/api` y
convierte la app web Next.js en cliente de esa API. La API es hexagonal, con un paquete por módulo, y
trae un módulo de ejemplo `tasks` cuyas capas de dominio y aplicación son Java plano.

| | Spring Boot | Quarkus |
| --- | --- | --- |
| Versión | 4.1.1 | 3.40.1 |
| Java | 21 | 21 |
| Build | Maven Wrapper (`apps/api/mvnw`) | Maven Wrapper (`apps/api/mvnw`) |
| Persistencia | JDBC + Flyway + PostgreSQL | JDBC (Agroal) + Flyway + PostgreSQL |
| PostgreSQL real en los tests | Testcontainers | Dev Services |
| UI de OpenAPI | `/swagger-ui.html` | `/q/swagger-ui` |
| Salud | `/actuator/health` | `/q/health` |
| Fichero de configuración | `application.yml` | `application.properties` |

## Crear uno

```bash
forja init shop --yes --backend spring
forja init shop --yes --backend quarkus
```

El asistente pregunta lo mismo en orden: el paquete Java raíz, ArchUnit, una app web, la base de datos,
la autenticación, el sistema de diseño, los tests end-to-end y los extras.

Los valores predeterminados de Java con `--yes`: una app web, PostgreSQL en Docker, OAuth2 con
Keycloak, ArchUnit activado, Tailwind, tests unitarios y de integración, y los extras `lint`, `docker` y
`specgate`. CI nunca está activado por defecto; añádelo con `--extras lint,docker,specgate,ci` si
quieres un workflow de GitHub Actions.

### El paquete Java

El paquete raíz es por defecto `com.<name>`, sin guiones: `forja init my-shop` da `com.myshop`. Elige
el tuyo con `--java-package`:

```bash
forja init shop --yes --backend spring --java-package com.acme.shop
```

Debe tener al menos dos segmentos de letras minúsculas, dígitos y guiones bajos.

### Solo API

Pasa una lista de plataformas vacía y forja omite la app web, `packages/shared` y el Dockerfile web:

```bash
forja init shop --yes --backend quarkus --platforms ""
```

Móvil aún no está disponible con un backend Java; `--platforms web,mobile` se rechaza.

## Qué obtienes

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

## Ejecutarlo

```bash
cd shop
docker compose up -d     # PostgreSQL + Keycloak (demo / demo)
npm install
npm run dev:api          # http://localhost:8080
npm run dev:web          # http://localhost:3000
```

El `package.json` raíz maneja las dos partes:

| Script | Ejecuta |
| --- | --- |
| `npm run dev:api` | `cd apps/api && ./mvnw spring-boot:run` (Spring) o `./mvnw quarkus:dev` (Quarkus) |
| `npm run dev:web` | `next dev` en `apps/web` |
| `npm run test:api` | `cd apps/api && ./mvnw -q -B verify` |
| `npm run test:web` | comprueba los tipos de los workspaces y construye `apps/web` |
| `npm test` | `test:api` y después `test:web` (solo `test:api` en un proyecto solo API) |

La configuración de la app web está en `apps/web/.env.local`, que forja escribe listo para usar con un
`AUTH_SECRET` aleatorio. `apps/web/.env.example` documenta las mismas claves.

Si el puerto 5432 está ocupado, `DB_PORT=5440 docker compose up -d` mueve PostgreSQL, y la API Spring
lee el mismo `DB_PORT`. En modo dev, Quarkus arranca su propio PostgreSQL mediante Dev Services; sus
ajustes `DB_URL`, `DB_PORT`, `DB_USER` y `DB_PASSWORD` se aplican al perfil de producción.

## OAuth2 con Keycloak

Con `--auth oauth2` (lo predeterminado), las piezas encajan así:

- La API es un resource server OAuth2. Valida el JWT y toma el usuario actual del `sub` del token,
  detrás del puerto `CurrentUser`. La tarea de otro usuario responde 404.
- La app web inicia sesión con Auth.js mediante Authorization Code + PKCE. Guarda los tokens en su
  cookie de sesión cifrada y llama a la API desde el servidor con el access token, así que el token
  nunca llega al navegador. El cierre de sesión es federado.
- `docker compose` ejecuta un Keycloak de desarrollo en `http://localhost:8180` que importa
  `infra/keycloak/<name>-realm.json`: un cliente `web` para Auth.js, un cliente `dev-cli` y dos
  usuarios, `demo` / `demo` y `other` / `other`. La consola de administración usa `admin` / `admin`.

Para llamar a la API a mano, pide a Keycloak un token con el cliente `dev-cli`:

```bash
curl -s -d grant_type=password -d client_id=dev-cli -d username=demo -d password=demo \
  http://localhost:8180/realms/shop/protocol/openid-connect/token | jq -r .access_token
```

Con `--auth none`, no hay Keycloak y la API usa un usuario local fijo.

## Errores, OpenAPI y salud

Los errores salen como RFC 9457 Problem Details (`application/problem+json`) con un `code` estable, como
`task_not_found`. Los clientes deciden según el `code`, no según el mensaje. OpenAPI y un endpoint de
salud están activados desde el principio.

## Tests

| Test | Qué demuestra |
| --- | --- |
| `TaskTest` | las reglas del dominio, sin framework |
| `TaskUseCasesTest` | los casos de uso, con dobles en memoria |
| `TaskApiTest` | la API HTTP de punta a punta, contra un PostgreSQL real |
| `StartupTest` | la aplicación real arranca con sus piezas reales, sin dobles |
| `ArchitectureTest` | las reglas hexagonales (con ArchUnit activado) |

Con `--db postgres-docker`, los tests de la API necesitan Docker en marcha: Spring usa Testcontainers y
Quarkus usa Dev Services. Con `--db none`, usan el adaptador en memoria.

### ArchUnit

ArchUnit está activado por defecto. `--no-archunit` deja fuera `ArchitectureTest`. Las reglas que
comprueba se listan en [Arquitectura](architecture.md#que-comprueba-archunit).

## Dockerfiles de producción

El extra `docker` escribe `apps/api/Dockerfile` (multi-stage, ejecutándose como usuario sin
privilegios) y, con app web, `apps/web/Dockerfile` para un build standalone de Next.js.

## Siguiente

- [Uso diario](daily-use.md): `forja add` pone las clases nuevas en el módulo correcto y las conecta en
  `<Module>Configuration`.
- [Tests end-to-end](e2e.md): Playwright a través de Keycloak y la API real.
