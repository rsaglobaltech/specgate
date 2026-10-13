# Getting started

forja creates a project with a hexagonal core and the apps around it. On the Node path you get a
TypeScript monorepo with a Next.js web app and an Expo mobile app. On the Java path you get a Spring
Boot or Quarkus API with a Next.js web app as its client. This page walks through the Node path; the
[Java backends](java.md) page covers the other one.

## Requirements

| Tool | When you need it |
| --- | --- |
| Node.js 22 or newer | Always. forja itself and every generated project run on it. |
| npm, pnpm or bun | Always. npm is the default; `--pm` picks another on Node. |
| Docker | With `--db postgres-docker` (the default on Node), for the PostgreSQL in `docker-compose.yml`. |
| JDK 21 | Java backends only. |

## Install

```bash Install
npm install -g @rsaglobaltech/forja
forja --version
```

You can also run it without installing:

```bash
npx @rsaglobaltech/forja init
```

## Your first project, with the wizard

```bash
forja init
```

The wizard asks for the project name and the backend. For a Node project it then asks for the scope of
the internal packages (`@acme/*`), the platforms (web, mobile), the database, authentication, the
mailer, the design system, the tests, the extras and the package manager. It only offers what forja can
generate, so every answer works.

When the files are written, it asks two more questions: install the dependencies now, and initialise
git with a first commit.

## Your first project, with `--yes`

`--yes` asks nothing. It takes the defaults and applies any flag you give on top.

```bash
forja init acme --yes
```

On Node the defaults are web and mobile, PostgreSQL in Docker, built-in sessions, the console mailer,
Tailwind, unit and integration tests, and ESLint with Prettier. [Configuration](config.md) lists every
default. A web-only project with in-memory repositories looks like this:

```bash
forja init acme --yes --platforms web --db none
```

With `--yes`, forja installs the dependencies and runs `git init` without asking. Add `--skip-install`
or `--skip-git` to leave either step to you. `--dry-run` prints the file tree and writes nothing.

## The next steps it prints

When it finishes, forja prints the commands to run next. For the default Node project:

```bash Next steps
cd acme
docker compose up -d
npm run db:push
npm run dev     # http://localhost:3000/login
npm run mobile  # Expo Go
npm test        # unit + integration
```

What each one does:

- `docker compose up -d` starts PostgreSQL. It only appears with `--db postgres-docker`.
- `npm run db:push` creates the tables from the Drizzle schema in `packages/core`.
- `npm run dev` starts the Next.js web app. Open `http://localhost:3000/login`, register a user and sign
  in. The password-reset email goes to the terminal, because the mailer is the console one.
- `npm run mobile` starts Expo. Scan the QR code with Expo Go on your phone. The mobile app signs in
  through the web app's API routes, so keep `npm run dev` running.
- `npm test` runs the unit and integration tests of `packages/core` with vitest.

If you skipped the install, the list starts with `npm install`. With the `specgate` extra or
`--tests e2e-web`, more lines follow; see [forja and Specgate](specgate.md) and
[End-to-end tests](e2e.md).

The core falls back to in-memory repositories when `DATABASE_URL` is not set, and logs a line saying
so. The app still runs; the data is lost on restart.

## What you get

The default Node project, trimmed to the main folders:

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

[The generated project](generated-project.md) lists the files each recipe writes.

## Where to go next

- [Daily use](daily-use.md): add use cases, entities and ports, and check the project with
  `forja doctor`.
- [Java backends](java.md): the same idea with Spring Boot or Quarkus.
- [Architecture](architecture.md): the rules the generated code keeps, and why.
