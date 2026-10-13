# CLI reference

```text
forja init [name] [options]
forja add usecase <module/Name> [options]
forja add entity <[module/]Name> [options]
forja add port <[module/]Name> [options]
forja doctor
forja --version
forja --help
```

`forja <command> --help` prints the options of each command.

## forja init

Creates a new project in `./<name>`. With no options it runs the wizard; with `--yes` or `--config` it
asks nothing.

| Option | Values | Notes |
| --- | --- | --- |
| `[name]` | lowercase letters, digits and hyphens, starting with a letter | Required with `--yes`. Also names the folder, the scope `@<name>` and the default Java package. |
| `--backend <backend>` | `node`, `spring`, `quarkus` | Default `node`. Picks the set of defaults with `--yes`; with `--config`, replaces the file's. Any other value stops with `Unknown backend`. |
| `--java-package <pkg>` | e.g. `com.acme.shop` | Java only. Default `com.<name>` without hyphens. |
| `--archunit` / `--no-archunit` | | Java only. ArchUnit is on by default for Java. Ignored on Node. |
| `--platforms <list>` | `web`, `mobile`, comma-separated | Node default `web,mobile`. Java: `web`, or `""` for an API only. |
| `--db <db>` | `postgres-docker`, `none` | Default `postgres-docker`. |
| `--auth <auth>` | `sessions` (Node), `oauth2` (Java), `none` | Node default `sessions`, Java default `oauth2`. |
| `--mailer <mailer>` | `console` | Used by Node sessions for password-reset emails. |
| `--design <design>` | `tailwind`, `none` | Default `tailwind`. |
| `--tests <list>` | `unit`, `integration`, `e2e-web` | Default `unit,integration`. The list replaces the default. |
| `--extras <list>` | `lint`, `ci`, `docker`, `specgate` | Node default `lint`; Java default `lint,docker,specgate`. The list replaces the default. |
| `--pm <pm>` | `npm`, `pnpm`, `bun` | Default `npm`. Java backends use `npm` only. |
| `--yes` | | Ask nothing: the defaults plus the flags. |
| `--config <path>` | a `forja.config.json` | Start from that file; the name and the flags override it. See [Configuration](config.md). |
| `--dry-run` | | Print the file tree and write nothing. |
| `--skip-install` | | Do not install the dependencies (and so do not adopt Specgate). |
| `--skip-git` | | Do not run `git init` or make the first commit. |

### What `init` does, in order

1. Builds the configuration from the wizard, from `--yes` and the flags, or from `--config` and the
   flags.
2. Validates it. An invalid configuration stops here, before anything is written.
3. Renders every file in memory, then formats `.ts`, `.tsx`, `.js`, `.jsx`, `.json`, `.css` and `.md`
   files with Prettier.
4. With `--dry-run`, prints the tree and stops.
5. Refuses if `./<name>` exists and is not empty.
6. Writes the files.
7. Unless skipped (and, in the wizard, after asking): `git init -b main` with a first commit
   `chore: scaffold with forja`, then the install with the chosen package manager, then the Specgate
   adoption when that extra is on.
8. Prints the next steps.

### Rejected combinations

Each of these stops `init` with `That configuration is not valid:` followed by one line per problem:

| Combination | Message |
| --- | --- |
| Node with no platform | `platforms: Choose at least one platform` |
| Java with `mobile` | `platforms: mobile with a Java backend is not supported yet: use --platforms web, or none for an API only` |
| Java with `--auth sessions` | `auth: with a Java backend, auth is oauth2 or none` |
| Node with `--auth oauth2` | `auth: auth oauth2 needs a Java backend (spring or quarkus)` |
| Node with `--java-package` | `javaPackage: --java-package needs a Java backend (spring or quarkus)` |
| Node with the `docker` extra | `extras: docker is for Java backends; a Node project gets docker-compose with --db postgres-docker` |
| `e2e-web` without `web` | `tests: e2e-web tests the web app: add web to the platforms` |
| `mobile` without `web`, with auth | `platforms: mobile needs web too when there is auth: the auth API lives in apps/web (route handlers)` |
| `archunit: true` on Node (from a config file) | `archunit: --archunit needs a Java backend (spring or quarkus)` |

A value outside the lists above is rejected too:

```text
That configuration is not valid:
  db: Invalid enum value. Expected 'postgres-docker' | 'none', received 'mysql'
```

So is a bad name or package:

```text
  name: Invalid name: use lowercase letters, digits and hyphens
  javaPackage: Invalid Java package: e.g. com.acme.shop
```

Other errors from `init`:

- `The project needs a name: "forja init <name> --yes"` when `--yes` has no name.
- `"<path>" already exists and is not empty.` when the target folder has files.

All of them exit with code 1.

## forja add

Adds a piece of the hexagon to the project you are in. [Daily use](daily-use.md) shows where each file
lands.

| Command | Argument | What it adds |
| --- | --- | --- |
| `forja add usecase` | `<module/Name>` | a use case, its test, and its wiring |
| `forja add entity` | `<[module/]Name>` | a domain entity and its test. Java needs the module. |
| `forja add port` | `<[module/]Name>` | an outbound port and an in-memory adapter. Java needs the module. |

| Option | Commands | Effect |
| --- | --- | --- |
| `--dry-run` | all | print what would change, write nothing |
| `--req <id>` | `usecase` | name this existing requirement (`REQ-007`) in the test |
| `--title <title>` | `usecase` | the requirement's title, when Specgate creates it |
| `--no-spec` | `usecase` | do not create a requirement in Specgate |
| `--no-adapter` | `port` | the port only, no in-memory adapter |

Errors, each with the fix on the line below:

| Situation | Message |
| --- | --- |
| No module where one is needed | `"PlaceOrder" needs its module: a use case lives in application/<module>/.` (Node) or `every class lives in one module of apps/api.` (Java) |
| An empty name, or more than one `/` | `"a/b/C" is not a name.` |
| The name does not start with a letter | `"..." does not give a valid class name.` |
| A bad module name | `"..." is not a valid module name.` |
| `--req` that is not `REQ-<digits>` | `"..." is not a requirement id.` |
| A file already exists | `<path> already exists.` |
| Outside a project | `No forja.config.json here or in any parent directory.` |
| An invalid `forja.config.json` | `forja.config.json is not valid:` and one line per problem |

They exit with code 1. See [forja and Specgate](specgate.md) for `--req`, `--title` and `--no-spec`.

## forja doctor

```bash
forja doctor
```

No options. It checks the tools, the `.env` files and the architecture rules of the project you are
in, and exits with code 1 when a check fails. [Daily use](daily-use.md#forja-doctor) lists every
check.

## forja --version

`forja --version` (or `-v`) prints the installed version.
