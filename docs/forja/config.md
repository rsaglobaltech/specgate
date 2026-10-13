# Configuration

Every project forja creates has a `forja.config.json` at its root. It records the choices made at
`forja init`, and `forja add` and `forja doctor` read it to know the backend, the package and the
extras. You can also write one by hand, or copy one from another project, and pass it to `forja init
--config`.

## An example

This is the file `forja init shop --yes --backend spring` writes:

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

`javaPackage` only appears when you set it. `$schema` and `version` are written by forja and not
read back.

## Fields

| Field | Type | Allowed values | Required |
| --- | --- | --- | --- |
| `name` | string | lowercase letters, digits and hyphens, starting with a letter | yes |
| `scope` | string | `@` followed by lowercase letters, digits and hyphens | yes |
| `platforms` | array | `web`, `mobile` | yes |
| `backend` | string | `node`, `spring`, `quarkus` | no, defaults to `node` |
| `javaPackage` | string | dotted lowercase segments, at least two: `com.acme.shop` | no |
| `archunit` | boolean | `true`, `false` | no, defaults to `false` |
| `arch` | string | `hexagonal` | yes |
| `db` | string | `postgres-docker`, `none` | yes |
| `auth` | string | `sessions`, `oauth2`, `none` | yes |
| `mailer` | string | `console` | yes |
| `design` | string | `tailwind`, `none` | yes |
| `ui` | string | `own` | yes |
| `edgeFunctions` | boolean | `false` | yes |
| `eas` | boolean | `false` | yes |
| `tests` | array | `unit`, `integration`, `e2e-web` | yes |
| `extras` | array | `lint`, `ci`, `docker`, `specgate` | yes |
| `pm` | string | `npm`, `pnpm`, `bun` (Java: `npm` only) | yes |

`arch`, `ui`, `edgeFunctions` and `eas` have one accepted value today. They hold the place of options
forja does not generate yet, and a hand-written file must still include them.

What each field means:

- `scope` names the internal packages: `@shop/core`, `@shop/shared`, `@shop/web`.
- `platforms` lists the apps. On Java, `[]` means an API only.
- `backend` decides where the logic lives: `packages/core` in TypeScript, or `apps/api` in Java.
- `javaPackage` is the root Java package. Without it, forja uses `com.<name>` with the hyphens removed.
- `archunit` adds the ArchUnit test on Java.
- `db: none` keeps the in-memory repositories; `postgres-docker` adds PostgreSQL in Docker.
- `auth: sessions` is the built-in session auth on Node; `oauth2` is Keycloak and Auth.js on Java.
- `mailer: console` prints emails to the terminal. It is used by Node sessions.
- `design: tailwind` adds Tailwind on the web and NativeWind on mobile, with shared design tokens.
- `tests` picks the test suites; `e2e-web` adds Playwright. See [End-to-end tests](e2e.md).
- `extras`: `lint` adds ESLint and Prettier, `ci` a GitHub Actions workflow, `docker` production
  Dockerfiles (Java), `specgate` the Specgate setup ([forja and Specgate](specgate.md)).
- `pm` is the package manager forja installs with and `forja doctor` checks.

The same cross-field rules as the flags apply; [CLI reference](cli.md#rejected-combinations) lists
them with their messages.

## Defaults

`forja init <name> --yes` starts from one of two sets of defaults, chosen by `--backend`:

| Field | Node (`defaultConfig`) | Java (`defaultJavaConfig`) |
| --- | --- | --- |
| `scope` | `@<name>` | `@<name>` |
| `platforms` | `["web", "mobile"]` | `["web"]` |
| `backend` | `node` | `spring` or `quarkus` |
| `javaPackage` | not set | not set, so `com.<name>` |
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

Neither set turns on `ci`. It writes a GitHub Actions workflow, which spends Actions minutes on a
private repository, so you ask for it.

## Starting from a file

```bash
forja init shop --config forja.config.json
forja init other-shop --config ./shop/forja.config.json --db none
```

forja reads and validates the file, then applies the name argument and the flags on top:

- The name argument replaces `name`. If the file's `scope` was `@<old name>`, it becomes `@<new name>`;
  a custom scope stays.
- `--platforms`, `--db`, `--auth`, `--mailer`, `--design`, `--tests`, `--extras`, `--pm` and
  `--java-package` replace the file's value. List flags replace the whole list.
- `--archunit` and `--no-archunit` apply when the file's backend is Java.
- `--backend` replaces the file's `backend`. The rest of the file must suit the new backend: `auth: sessions` with `--backend spring` is rejected.

The result is validated again, so a flag that breaks a rule is reported like any other.

`--config` asks nothing: like `--yes`, it installs the dependencies and runs `git init` unless you pass
`--skip-install` or `--skip-git`.

## Inside a project

`forja add` and `forja doctor` look for `forja.config.json` in the current directory and its parents,
and validate it. If you edit it by hand and break a rule, they stop with
`forja.config.json is not valid:` and the problem. Changing a field does not regenerate anything; it
only changes what `add` and `doctor` assume.
