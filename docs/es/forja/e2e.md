<!-- translation-of: d46e31513d8b -->
# Tests end-to-end

`--tests e2e-web` añade Playwright a la app web. Prueba la app en un navegador real, desde la página de
inicio hasta el inicio de sesión, y en Java a través de la API real.

```bash
forja init acme --yes --tests unit,integration,e2e-web
forja init shop --yes --backend spring --tests unit,integration,e2e-web
```

`--tests` sustituye la lista predeterminada, así que mantén `unit,integration` en ella. En el asistente,
Node ofrece "End to end (Playwright, web)" en Tests, y Java pregunta "End-to-end tests of the web app
(Playwright)?" después del sistema de diseño.

Los tests end-to-end necesitan una app web. Sin ella, forja se niega:

```text
That configuration is not valid:
  tests: e2e-web tests the web app: add web to the platforms
```

## Qué genera forja

Todo vive en `apps/web`:

| Fichero | Node, `--auth sessions` | Node, `--auth none` | Java |
| --- | --- | --- | --- |
| `playwright.config.ts` | sí | sí | sí |
| `e2e/smoke.spec.ts` | sí | sí | sí |
| `e2e/auth.spec.ts` | sí | no | no |
| `e2e/tasks.spec.ts` | no | no | sí |

También añade `@playwright/test` `~1.63.0` a `apps/web`, un script `test:e2e` allí y un `test:e2e` en la
raíz que lo ejecuta.

### Los tests

- **smoke**: la página de inicio responde, y su encabezado principal lleva el nombre del proyecto.
- **auth** (Node con sesiones): registrarse con un email nuevo, cerrar sesión, volver a iniciarla; una
  contraseña incorrecta se rechaza con "Invalid email or password"; `/dashboard` sin sesión te lleva a
  `/login`. Cada ejecución usa un email nuevo, así que no necesita una base de datos limpia.
- **tasks** (Java): con OAuth2, iniciar sesión en la página de login de Keycloak como `demo` / `demo`,
  añadir una tarea, marcarla como hecha y cerrar sesión; después comprobar que `/tasks` sin sesión
  muestra el botón de iniciar sesión. Con `--auth none`, el mismo recorrido sin el inicio de sesión.

### Qué arranca Playwright

`playwright.config.ts` arranca lo que necesitan los tests, y reutiliza un servidor que ya esté en marcha
cuando no está en CI:

| | Node | Java |
| --- | --- | --- |
| App web | `npm run dev -- --port 3000` | `npm run dev -- --port 3000` |
| API | ninguna | `npm run dev:api` desde la raíz, esperando a `/actuator/health` (Spring) o `/q/health` (Quarkus) |
| Lo arrancas tú | nada | PostgreSQL y Keycloak, con `docker compose` |

`E2E_PORT` cambia el puerto web y `E2E_BASE_URL` apunta los tests a otra URL. Los tests se ejecutan en
Desktop Chrome (Chromium), de uno en uno, guardando las trazas cuando fallan.

## Los escenarios (BDD), con Specgate

Con el extra `specgate`, e2e-web también conecta
[playwright-bdd](https://vitalets.github.io/playwright-bdd/) `~9.2.1`, así que los ficheros feature que
Specgate escribe cuando se aprueba un change se ejecutan antes que cualquier código:

- `playwright.config.ts` recibe dos proyectos: `e2e` (los tests de arriba) y `bdd`, generado a partir de
  los `features/**/*.feature` del repositorio en `apps/web/.features-gen` (ignorado por git).
- Los pasos viven en `apps/web/e2e/steps/`; `steps.ts` exporta `Given`, `When` y `Then`.
- Un escenario cuyos pasos aún no están escritos falla al ejecutarse (`Missing step: …`), nunca al
  generarse: primero rojo, después los pasos, después verde.
- `npm run test:bdd` en la raíz los ejecuta; el gate de Specgate lo ejecuta con la etiqueta del
  requisito: `bdd_cmd: npm run test:bdd --silent -- --grep "{tags}"`, y `bdd: required` en
  `.specgate/gate.yaml`.

`test:e2e` ejecuta solo el proyecto `e2e`.

## Ejecutarlos

En Node:

```bash
npx playwright install chromium   # once: the browser the tests drive
npm run test:e2e
```

En Java, arranca primero PostgreSQL y Keycloak. `--wait` vuelve en cuanto los dos indican que están
sanos, Keycloak incluido, así que el realm se importa antes del primer inicio de sesión:

```bash
npx playwright install chromium   # once
docker compose up -d --wait       # PostgreSQL and Keycloak
npm run test:e2e                  # Playwright starts the API and the web app
```

forja imprime los mismos comandos entre sus siguientes pasos cuando e2e está activado.

## En CI

Con el extra `ci`, el `.github/workflows/ci.yml` generado recibe un job `e2e`. Prepara Node 22 (y Java
21 con caché de Maven en Java), ejecuta `docker compose up -d --wait` en Java cuando el proyecto tiene
PostgreSQL o Keycloak, instala las dependencias, ejecuta `npx playwright install --with-deps
chromium` y `npm run test:e2e`, y sube `apps/web/playwright-report` cuando falla un test.

El extra `ci` está desactivado por defecto: escribe un workflow de GitHub Actions, que gasta minutos de
Actions en un repositorio privado.

## Relacionado

- [Primeros pasos](getting-started.md) y [Backends Java](java.md) para los proyectos contra los que se
  ejecutan estos tests.
- [Referencia de la CLI](cli.md) para cada valor que acepta `--tests`.
