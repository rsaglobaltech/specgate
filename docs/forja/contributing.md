# Contributing

This page is for working on forja itself. You need Node.js 22 or newer. To check what forja generates
for Java, you also need a JDK 21 and Docker.

## Set up

```bash
git clone https://github.com/rsaglobaltech/forja.git
cd forja
npm install
npm run build
npm link          # puts your local build on the PATH as `forja`
```

## Day to day

| Command | What it does |
| --- | --- |
| `npm run dev -- <args>` | runs the CLI from `src/` with tsx, no build needed |
| `npm test` | the vitest suite in `tests/` |
| `npm run test:watch` | the same, in watch mode |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint over `src` and `tests` |
| `npm run build` | compiles to `dist/`, which the `forja` binary runs |
| `npm run site` | builds forja's landing page (and redirects to these docs) into `_site/` |
| `npm run site:publish` | the same into `docs/`, which GitHub Pages serves from `main`: commit the result |

`--dry-run` is the quickest way to see what a change does:

```bash
npm run dev -- init demo --yes --dry-run
npm run dev -- init demo --yes --backend quarkus --dry-run
```

The tests cover the configuration rules (`schema.test.ts`), the recipe order (`planner.test.ts`), the
rendering of every Java combination and of the Node path (`render.test.ts`, `render-node.test.ts`),
the end-to-end recipe (`e2e-web.test.ts`), the next steps (`postinstall.test.ts`), `forja add`
(`add.test.ts`) and `forja doctor` (`doctor.test.ts`).

## Proving a generated project works

The unit tests show that forja renders the right files. `scripts/verify-generated.sh` shows that those
files work: it generates a project with the built CLI, installs it and runs everything.

```bash
npm run build
scripts/verify-generated.sh node
scripts/verify-generated.sh spring
scripts/verify-generated.sh quarkus
```

For each backend it runs `forja init` with Playwright and the extras, then `forja add usecase`,
`add entity` and `add port`, `forja doctor`, the tests, the type check and lint. On Node it also builds
the web app for production, bundles the mobile app for iOS, Android and web, and runs `expo-doctor`.
Then it runs the Playwright tests in a real browser, and last `specgate validate --strict`.

What it needs:

- Docker running. The Java paths start PostgreSQL and Keycloak with `docker compose up -d --wait`, and
  Testcontainers or Dev Services start their own PostgreSQL.
- Ports 3000, 5432, 8080 and 8180 free. Run one backend at a time.
- A JDK 21 for the Java paths.

A second argument sets the working directory; without it the script uses a new temporary directory.

## How a recipe works

A recipe is one concern of the generated project. It lives in `src/recipes/<id>.ts`, and its templates
in `templates/<id>/`.

```ts src/recipes/keycloak.ts
import { defineRecipe } from "./types.js";

export default defineRecipe({
  id: "keycloak",
  apply(ctx) {
    ctx.copyFile("keycloak/realm.json.ejs", `infra/keycloak/${ctx.config.name}-realm.json`);
  },
});
```

`apply` receives a `RecipeContext`. Everything it writes goes to an in-memory file system; nothing
reaches the disk until every recipe has run and Prettier has formatted the result.

| Method | What it does |
| --- | --- |
| `ctx.config` | the validated configuration |
| `ctx.has(flag)` | whether `flag` is in `platforms`, `tests` or `extras` |
| `ctx.copyFile(src, dest, data?)` | copies one template file; a `.ejs` file is rendered with `{ config, ...data }` |
| `ctx.copyDir(src, dest, data?, mapPath?)` | copies a template folder recursively; `.ejs` files are rendered and lose the suffix; `mapPath` renames paths |
| `ctx.mergePackageJson(dir, patch)` | merges `dependencies`, `devDependencies` and `scripts` into `<dir>/package.json` |
| `ctx.addEnv(key, default, comment?, section?)` | declares a variable for the root `.env.example` |
| `ctx.write(path, content)` / `ctx.read(path)` | writes or reads a file in the generated project |
| `ctx.markExecutable(path)` | sets the executable bit when written to disk, as for `mvnw` |

Two details matter:

- `mergePackageJson` throws if two recipes set the same script to different values. A recipe owns its
  scripts.
- `copyFile` replaces a file, `mergePackageJson` merges into one. A recipe that creates a
  `package.json` with `copyFile` has to run before any recipe that merges into it. The planner's order
  takes care of that.

The Java recipes use two helpers from `src/recipes/java.ts`: `copyJava`, which turns `__pkg__` in a
template path into the package path (`com/acme/shop`), and the `versions` object that pins Spring Boot,
Quarkus, ArchUnit, Keycloak, PostgreSQL and Specgate.

## Adding a recipe

1. Write `src/recipes/<id>.ts` with `defineRecipe`, and its templates in `templates/<id>/`.
2. Register it in `src/recipes/registry.ts`.
3. Plan it in `src/engine/planner.ts`: `planRecipes` for Node, `planJava` for Java. The order is
   written by hand; put the recipe after the ones whose files it merges into.
4. If it adds a choice, add the value to `src/config/schema.ts`, with a cross-field rule if some
   combination cannot work. The schema accepts only what a recipe implements, so a value without a
   recipe never reaches the planner.
5. Offer it in `src/prompts/wizard.ts` and in the `init` options in `src/cli.ts`.
6. If the user has to run something afterwards, add it to `nextSteps` in `src/engine/postinstall.ts`.
7. Add tests: the schema rule, the planner order, and the rendered files.
8. Run `scripts/verify-generated.sh` on the paths the recipe touches.

## Releases

forja is not published to the npm registry. A release is a package tarball attached to a GitHub
release of the forja repository (for 1.0.0, `rsaglobaltech-forja-1.0.0.tgz`), and users install it
from that URL, as [Getting started](getting-started.md#install) shows. The tarball is built on a local
machine once the build, the type check and the tests pass. There is no release pipeline. The
repository contains a `.github/workflows/ci.yml`, but it is not used: GitHub Actions stay off, and
every check above runs locally.

Record each change in `CHANGELOG.md`, and tick the matching box in `ROADMAP.md`, in the same pull
request.

These pages live in the Specgate repository, under `docs/forja/` (ADR-0033): one documentation site
for both tools. Edit them there.
