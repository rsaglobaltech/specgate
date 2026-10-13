# Daily use

After `forja init`, two commands keep working inside the project: `forja add` writes new pieces of the
hexagon in the right place with a passing test, and `forja doctor` checks that your machine and the
project are in shape.

Both read `forja.config.json`. Run them anywhere inside the project; forja walks up the directories
until it finds that file. Outside a project you get:

```text
No forja.config.json here or in any parent directory.
Run this inside a project created with `forja init`.
```

## forja add

```bash
forja add usecase orders/PlaceOrder      # a use case, its test, and its wiring
forja add entity orders/Order            # a domain entity and its test
forja add port orders/OrderRepository    # an outbound port and an in-memory adapter
```

The argument is `<module>/<Name>`. forja turns the name into PascalCase (`place-order` and
`placeOrder` both become `PlaceOrder`) and the module into lowercase letters and digits (`Order-Items`
becomes `orderitems`). On Node, a trailing `UseCase` is dropped, so `PlaceOrderUseCase` does not become
`PlaceOrderUseCaseUseCase`.

| | Node | Java |
| --- | --- | --- |
| `usecase` | module required | module required |
| `entity` | module optional, and not used in the path | module required |
| `port` | module optional, and not used in the path | module required |

### Where the files land on Node

Everything goes into `packages/core`.

| Command | Created | Updated |
| --- | --- | --- |
| `add usecase orders/PlaceOrder` | `src/application/orders/PlaceOrderUseCase.ts`, `tests/unit/orders/PlaceOrderUseCase.test.ts` | `src/index.ts`, `src/infrastructure/config/container.ts` |
| `add entity Order` | `src/domain/entities/Order.ts`, `tests/unit/Order.test.ts` | `src/index.ts` |
| `add port OrderRepository` | `src/ports/IOrderRepository.ts`, `src/infrastructure/database/repositories/InMemoryOrderRepository.ts` | `src/index.ts` |
| `add port PaymentGateway` | `src/ports/IPaymentGateway.ts`, `src/infrastructure/adapters/InMemoryPaymentGateway.ts` | `src/index.ts` |

A port whose name ends in `Repository` gets its adapter in `infrastructure/database/repositories/`;
any other port gets it in `infrastructure/adapters/`.

The use case is exported from the core's `index.ts` and registered in `buildContainer()` in
`container.ts`, as `placeOrderUseCase: new PlaceOrderUseCase()`. forja edits the container through its
syntax tree, so your own layout and comments stay as they are. If `container.ts` has no
`buildContainer()` that returns an object, forja stops and tells you the line to add by hand.

The use case returns a `Result` and its test checks `result.ok`. The entity has `create()`,
`fromPersistence()` and `toPersistence()`, and its test checks the round trip.

### Where the files land on Java

Everything goes into one module of `apps/api`. With `com.shop` as the root package, `main/` below
stands for `apps/api/src/main/java/com/shop/orders/` and `test/` for
`apps/api/src/test/java/com/shop/orders/`:

| Command | Created | Updated |
| --- | --- | --- |
| `add usecase orders/PlaceOrder` | `main/application/PlaceOrder.java`, `test/application/PlaceOrderTest.java` | `main/infrastructure/config/OrdersConfiguration.java` |
| `add entity orders/Order` | `main/domain/Order.java` (a record), `test/domain/OrderTest.java` | nothing |
| `add port orders/OrderRepository` | `main/application/port/OrderRepository.java`, `main/infrastructure/persistence/InMemoryOrderRepository.java` | nothing |
| `add port orders/PaymentGateway` | `main/application/port/PaymentGateway.java`, `main/infrastructure/adapters/InMemoryPaymentGateway.java` | nothing |

As on Node, a `Repository` port gets its adapter in `persistence/` and any other port in `adapters/`.

The use case carries no annotations. forja adds a bean for it to `<Module>Configuration` in the
module's `infrastructure/config`, and creates that class the first time the module gets a use case:

```java OrdersConfiguration.java
@Configuration(proxyBeanMethods = false)
class OrdersConfiguration {
  @Bean
  PlaceOrder placeOrder() {
    return new PlaceOrder();
  }
}
```

On Quarkus the method is a CDI producer (`@Produces @ApplicationScoped`) instead of a `@Bean`. The
in-memory adapter is a Spring `@Component` or a Quarkus `@ApplicationScoped` bean. All of this keeps
the [ArchUnit rules](architecture.md#what-archunit-checks) green.

### Options

| Option | Commands | What it does |
| --- | --- | --- |
| `--dry-run` | all | prints what would be created and updated, writes nothing |
| `--no-adapter` | `port` | the port only, no in-memory adapter |
| `--req <id>` | `usecase` | names an existing requirement, such as `REQ-007`, in the test |
| `--title <title>` | `usecase` | the requirement's title, when Specgate creates it |
| `--no-spec` | `usecase` | leaves the specification alone |

The last three matter when the project uses Specgate; see [forja and Specgate](specgate.md).

```bash
forja add usecase orders/PlaceOrder --dry-run
forja add port PaymentGateway --no-adapter
```

### Nothing is overwritten

If any file forja would create already exists, the command stops before writing anything:

```text
packages/core/src/application/orders/PlaceOrderUseCase.ts already exists.
Pick another name, or delete the file if it is a leftover.
```

Every check runs first, then every file is written at once, so a refused `add` leaves the project as
it was.

After each command, forja prints the next step: `npm test` on Node, `npm run test:api` on Java, or, for
a port, "give the port its first method, then pass it to the use case that needs it".

## forja doctor

```bash
forja doctor
```

It runs these checks, in this order:

| Check | When | Passes when | Otherwise |
| --- | --- | --- | --- |
| Node.js | always | version 22 or newer | fail |
| package manager | always | `<pm> --version` answers (the `pm` from the config) | fail |
| Java | Java backends | `java -version` reports JDK 21 or newer | fail |
| Docker | `db` is `postgres-docker`, or `auth` is `oauth2`, or a Java project with integration tests | `docker info` answers | fail |
| env | one per `.env.example` in the project | the `.env` or `.env.local` beside it has every key | warn |
| React | Node, when two or more of the root, `apps/web` and `apps/mobile` declare React | they all declare the same version | fail |
| core imports | Node | see below | fail |
| Specgate | the `specgate` extra | `spec.md` and `docs/specs/traceability.md` exist | warn |

The core-imports check reads every `.ts` and `.tsx` file under `packages/core/src`. It fails if any of
them imports `next`, `react`, `react-dom`, `react-native` or `expo`, or if a file in `domain/`,
`application/` or `ports/` imports from `infrastructure/`. It names the file and line.

A missing `.env` is a warning, because the code has defaults. Each failed or warned check prints the
command or edit that fixes it:

```text
▲  env (root)     no .env yet: the defaults in the code apply
│  cp .env.example .env
```

The last line sums up: `Ready`, `Ready, with 1 to look at`, or `2 to fix, 1 to look at`. `forja doctor`
exits with code 1 when at least one check fails, and 0 otherwise, so you can use it in a script.

Directories named `node_modules`, `.git`, `.next`, `.expo`, `dist`, `target` and `build` are skipped.
