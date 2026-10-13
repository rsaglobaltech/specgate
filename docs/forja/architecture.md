# Architecture

Every project forja generates is hexagonal, also called ports and adapters. There is one rule behind
it: dependencies point towards the domain. The business rules know nothing about the web framework,
the database or the mail provider, and those pieces plug in from the outside.

```text
infrastructure  ──►  application  ──►  domain
 (framework,          (use cases,        (entities, value objects,
  database, HTTP,      ports)             rules: plain code)
  security)
```

## The layers

| Layer | What it holds | Node: `packages/core/src/` | Java: `apps/api/.../<module>/` |
| --- | --- | --- | --- |
| Domain | entities, value objects, events, the rules | `domain/` | `domain/` |
| Application | use cases, one per class | `application/<module>/` | `application/` |
| Ports | the interfaces the use cases need | `ports/` | `application/port/` |
| Infrastructure | adapters and the composition root | `infrastructure/` | `infrastructure/` |

On Node, the hexagon is the `packages/core` workspace, shared by the web and mobile apps. On Java, each
module of `apps/api` is its own small hexagon (`tasks` to start with), plus a `shared` package for the
cross-cutting pieces such as `DomainException` and the `CurrentUser` port.

### Domain

Plain TypeScript or plain Java: no framework, no database, no HTTP. An entity is created through a
factory, such as `User.create` or `Task.create`. Value objects such as `Email`, `Password` and
`TaskTitle` refuse invalid input when they are built, so the rest of the code can trust them.

### Application

A use case orchestrates the domain through ports. Everything it needs from the outside world, such as
a repository, a clock, a password hasher or a mailer, comes in through its constructor as an
interface. That is what lets the tests run a use case against in-memory adapters, with nothing started.

On Java, use cases carry no framework annotations. `CompleteTask` is a plain `final class` with a
constructor.

### Infrastructure

Adapters implement the ports: Drizzle and in-memory repositories, bcrypt, a console mailer, a system
clock on Node; JDBC and in-memory repositories, REST controllers, JWT security on Java. The
infrastructure is also where the pieces are put together.

## The composition root

One place knows both the use cases and the adapters, and wires them.

On Node it is `packages/core/src/infrastructure/config/container.ts`. `buildContainer()` creates the
adapters and returns an object with every use case built on them. Each adapter is chosen by its own
switch: `hasDatabase()` picks the Drizzle repositories when `DATABASE_URL` is set and the in-memory ones
otherwise. There is no single "demo mode" flag that turns everything off at once. The container is kept
on `globalThis`, so Next.js's separate server bundles share one instance and one set of in-memory data.

On Java it is a `<Module>Configuration` class in each module's `infrastructure/config`:
`TasksConfiguration` declares Spring `@Bean` methods, or CDI `@Produces` methods on Quarkus, that call
the use cases' constructors.

`forja add usecase` registers new use cases in the same place: in `buildContainer()` on Node, and in
`<Module>Configuration` on Java. See [Daily use](daily-use.md).

## What ArchUnit checks

On Java with ArchUnit on (the default), `ArchitectureTest` runs on every `./mvnw verify` and fails the
build when one of these rules breaks:

| Rule | What it says |
| --- | --- |
| `domainIsPureJava` | nothing in `..domain..` depends on `..application..`, `..infrastructure..` or the framework |
| `applicationHasNoFrameworkNorAdapters` | nothing in `..application..` depends on `..infrastructure..` or the framework |
| `portsAreInterfaces` | every class in `..application.port..` is an interface |
| `modulesDoNotUseEachOthersInfrastructure` | the `infrastructure` of one module does not depend on another module's |
| `noCycles` | no dependency cycles between modules |

"The framework" means `org.springframework..`, `jakarta..` and `io.swagger..` on Spring Boot, and
`io.quarkus..`, `jakarta..`, `org.eclipse.microprofile..` and `io.smallrye..` on Quarkus. Test classes
are not analysed.

## What npm run arch and forja doctor check on Node

Node has no ArchUnit, so the generated project carries `scripts/check-architecture.mjs`, run with
`npm run arch`, and `forja doctor` runs the same check. The script has no dependencies, so it runs
wherever the project does, and Specgate's gate runs it as `arch_cmd`. Both check the core's imports. It reads every `.ts` and `.tsx` file
under `packages/core/src` and fails when:

- any file imports `next`, `react`, `react-dom`, `react-native` or `expo`, or a subpath of them;
- a file in `domain/`, `application/` or `ports/` imports from `infrastructure/`.

It names the file and the line, and suggests moving that code to `apps/*` or `infrastructure/` and
reaching it through a port. It also checks that the root, the web app and the mobile app declare one
React version, because two copies break hooks. [Daily use](daily-use.md#forja-doctor) lists the rest.

## Expected errors as values

On Node, a use case returns a `Result` for the errors the business expects:

```ts packages/core/src/domain/shared/Result.ts
export type Result<T, E> = { ok: true; value: T } | { ok: false; error: E };
```

`RegisterUseCase` returns `err(new EmailAlreadyInUseError())` when the email is taken, and
`ok({ userId })` when it is not. The reasons:

- The signature says what can go wrong. `Result<RegisterOutput, EmailAlreadyInUseError>` tells the
  caller which errors to handle; a thrown exception does not appear in the type.
- The caller has to look at `ok` before it can reach `value`, so an expected failure cannot slip
  through unhandled.
- Each domain error has a stable `code`, such as `EMAIL_ALREADY_IN_USE`, that the web app and the mobile
  app can map to a message.

Failures nobody expects, such as the database being down, still throw. They are not part of the
business, and no caller can do much about them. Value objects also throw when they are built from
invalid input: `Email.create` throws an `InvalidEmailError`, which is a `DomainError` with its own
`code`. The web app's Server Actions and API route handlers validate input with the zod schemas in
`packages/shared` before it reaches the core.

The use cases `forja add` writes follow the same shape: `execute()` returns `Promise<Result<...>>`, and
the test checks `result.ok`.

On Java the generated code takes the language's usual route: a broken rule throws a `DomainException`
with a stable `code` and a kind (invalid, not found, conflict, forbidden), and the web layer turns it
into an RFC 9457 Problem Details response carrying that `code`.

## One test that boots everything

Most tests replace pieces with doubles. Java projects also get `StartupTest`, which starts the
application with its real pieces. It proves that the real adapters exist and are wired, which a suite
of green unit tests cannot.
