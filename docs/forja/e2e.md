# End-to-end tests

`--tests e2e-web` adds Playwright to the web app. It tests the app in a real browser, from the home page
through sign-in, and on Java through the real API.

```bash
forja init acme --yes --tests unit,integration,e2e-web
forja init shop --yes --backend spring --tests unit,integration,e2e-web
```

`--tests` replaces the default list, so keep `unit,integration` in it. In the wizard, Node offers
"End to end (Playwright, web)" under Tests, and Java asks "End-to-end tests of the web app
(Playwright)?" after the design system.

End-to-end tests need a web app. Without one, forja refuses:

```text
That configuration is not valid:
  tests: e2e-web tests the web app: add web to the platforms
```

## What forja generates

All of it lives in `apps/web`:

| File | Node, `--auth sessions` | Node, `--auth none` | Java |
| --- | --- | --- | --- |
| `playwright.config.ts` | yes | yes | yes |
| `e2e/smoke.spec.ts` | yes | yes | yes |
| `e2e/auth.spec.ts` | yes | no | no |
| `e2e/tasks.spec.ts` | no | no | yes |

It also adds `@playwright/test` `~1.63.0` to `apps/web`, a `test:e2e` script there, and a root
`test:e2e` that runs it.

### The tests

- **smoke**: the home page answers, and its main heading carries the project name.
- **auth** (Node with sessions): register with a new email, sign out, sign in again; a wrong password
  is refused with "Invalid email or password"; `/dashboard` without a session sends you to `/login`.
  Each run uses a fresh email, so it needs no clean database.
- **tasks** (Java): with OAuth2, sign in through Keycloak's login page as `demo` / `demo`, add a task,
  mark it done and sign out; then check that `/tasks` without a session shows the sign-in button. With
  `--auth none`, the same walk without the sign-in.

### What Playwright starts

`playwright.config.ts` starts what the tests need, and reuses a server that is already running when
not in CI:

| | Node | Java |
| --- | --- | --- |
| Web app | `npm run dev -- --port 3000` | `npm run dev -- --port 3000` |
| API | none | `npm run dev:api` from the root, waiting for `/actuator/health` (Spring) or `/q/health` (Quarkus) |
| Started by you | nothing | PostgreSQL and Keycloak, with `docker compose` |

`E2E_PORT` changes the web port and `E2E_BASE_URL` points the tests at another URL. The tests run in
Desktop Chrome (Chromium), one at a time, with traces kept on failure.

## Run them

On Node:

```bash
npx playwright install chromium   # once: the browser the tests drive
npm run test:e2e
```

On Java, start PostgreSQL and Keycloak first. `--wait` returns once both report healthy, Keycloak
included, so the realm is imported before the first sign-in:

```bash
npx playwright install chromium   # once
docker compose up -d --wait       # PostgreSQL and Keycloak
npm run test:e2e                  # Playwright starts the API and the web app
```

forja prints the same commands among its next steps when e2e is on.

## In CI

With the `ci` extra, the generated `.github/workflows/ci.yml` gets an `e2e` job. It sets up Node 22
(and Java 21 with Maven caching on Java), runs `docker compose up -d --wait` on Java when the project
has PostgreSQL or Keycloak, installs the dependencies, runs `npx playwright install --with-deps
chromium` and `npm run test:e2e`, and uploads `apps/web/playwright-report` when a test fails.

The `ci` extra is off by default: it writes a GitHub Actions workflow, which spends Actions minutes on
a private repository.

## Related

- [Getting started](getting-started.md) and [Java backends](java.md) for the projects these tests run
  against.
- [CLI reference](cli.md) for every value `--tests` accepts.
