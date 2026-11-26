<!-- translation-of: c1c5adc0054e -->
# Uso diario

Después de `forja init`, dos comandos siguen funcionando dentro del proyecto: `forja add` escribe
piezas nuevas del hexágono en el sitio correcto con un test que pasa, y `forja doctor` comprueba que tu
máquina y el proyecto están en forma.

Los dos leen `forja.config.json`. Ejecútalos en cualquier lugar dentro del proyecto; forja sube por los
directorios hasta encontrar ese fichero. Fuera de un proyecto obtienes:

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

El argumento es `<module>/<Name>`. forja convierte el nombre a PascalCase (`place-order` y `placeOrder`
pasan ambos a ser `PlaceOrder`) y el módulo a letras minúsculas y dígitos (`Order-Items` pasa a ser
`orderitems`). En Node se elimina un `UseCase` final, así que `PlaceOrderUseCase` no se convierte en
`PlaceOrderUseCaseUseCase`.

| | Node | Java |
| --- | --- | --- |
| `usecase` | módulo obligatorio | módulo obligatorio |
| `entity` | módulo opcional, y no se usa en la ruta | módulo obligatorio |
| `port` | módulo opcional, y no se usa en la ruta | módulo obligatorio |

### Dónde acaban los ficheros en Node

Todo va a `packages/core`.

| Comando | Creados | Actualizados |
| --- | --- | --- |
| `add usecase orders/PlaceOrder` | `src/application/orders/PlaceOrderUseCase.ts`, `tests/unit/orders/PlaceOrderUseCase.test.ts` | `src/index.ts`, `src/infrastructure/config/container.ts` |
| `add entity Order` | `src/domain/entities/Order.ts`, `tests/unit/Order.test.ts` | `src/index.ts` |
| `add port OrderRepository` | `src/ports/IOrderRepository.ts`, `src/infrastructure/database/repositories/InMemoryOrderRepository.ts` | `src/index.ts` |
| `add port PaymentGateway` | `src/ports/IPaymentGateway.ts`, `src/infrastructure/adapters/InMemoryPaymentGateway.ts` | `src/index.ts` |

Un puerto cuyo nombre termina en `Repository` recibe su adaptador en
`infrastructure/database/repositories/`; cualquier otro puerto lo recibe en `infrastructure/adapters/`.

El caso de uso se exporta desde el `index.ts` del core y se registra en `buildContainer()` en
`container.ts`, como `placeOrderUseCase: new PlaceOrderUseCase()`. forja edita el contenedor a través de
su árbol sintáctico, así que tu propia disposición y tus comentarios se quedan como están. Si
`container.ts` no tiene un `buildContainer()` que devuelva un objeto, forja se detiene y te dice la
línea que debes añadir a mano.

El caso de uso devuelve un `Result` y su test comprueba `result.ok`. La entidad tiene `create()`,
`fromPersistence()` y `toPersistence()`, y su test comprueba el viaje de ida y vuelta.

### Dónde acaban los ficheros en Java

Todo va a un módulo de `apps/api`. Con `com.shop` como paquete raíz, `main/` representa abajo
`apps/api/src/main/java/com/shop/orders/` y `test/` representa
`apps/api/src/test/java/com/shop/orders/`:

| Comando | Creados | Actualizados |
| --- | --- | --- |
| `add usecase orders/PlaceOrder` | `main/application/PlaceOrder.java`, `test/application/PlaceOrderTest.java` | `main/infrastructure/config/OrdersConfiguration.java` |
| `add entity orders/Order` | `main/domain/Order.java` (un record), `test/domain/OrderTest.java` | nada |
| `add port orders/OrderRepository` | `main/application/port/OrderRepository.java`, `main/infrastructure/persistence/InMemoryOrderRepository.java` | nada |
| `add port orders/PaymentGateway` | `main/application/port/PaymentGateway.java`, `main/infrastructure/adapters/InMemoryPaymentGateway.java` | nada |

Como en Node, un puerto `Repository` recibe su adaptador en `persistence/` y cualquier otro puerto en
`adapters/`.

El caso de uso no lleva anotaciones. forja le añade un bean en `<Module>Configuration`, en el
`infrastructure/config` del módulo, y crea esa clase la primera vez que el módulo recibe un caso de uso:

```java OrdersConfiguration.java
@Configuration(proxyBeanMethods = false)
class OrdersConfiguration {
  @Bean
  PlaceOrder placeOrder() {
    return new PlaceOrder();
  }
}
```

En Quarkus el método es un productor CDI (`@Produces @ApplicationScoped`) en lugar de un `@Bean`. El
adaptador en memoria es un `@Component` de Spring o un bean `@ApplicationScoped` de Quarkus. Todo esto
mantiene en verde las [reglas de ArchUnit](architecture.md#que-comprueba-archunit).

### Opciones

| Opción | Comandos | Qué hace |
| --- | --- | --- |
| `--dry-run` | todos | imprime lo que se crearía y actualizaría, no escribe nada |
| `--no-adapter` | `port` | solo el puerto, sin adaptador en memoria |
| `--req <id>` | `usecase` | nombra un requisito existente, como `REQ-007`, en el test |
| `--title <title>` | `usecase` | el título del requisito, cuando Specgate lo crea |
| `--no-spec` | `usecase` | deja la especificación como está |

Las tres últimas importan cuando el proyecto usa Specgate; consulta [forja y Specgate](specgate.md).

```bash
forja add usecase orders/PlaceOrder --dry-run
forja add port PaymentGateway --no-adapter
```

### No se sobrescribe nada

Si algún fichero que forja crearía ya existe, el comando se detiene antes de escribir nada:

```text
packages/core/src/application/orders/PlaceOrderUseCase.ts already exists.
Pick another name, or delete the file if it is a leftover.
```

Primero se ejecutan todas las comprobaciones y después se escriben todos los ficheros a la vez, así que
un `add` rechazado deja el proyecto como estaba.

Después de cada comando, forja imprime el siguiente paso: `npm test` en Node, `npm run test:api` en
Java o, para un puerto, "give the port its first method, then pass it to the use case that needs it".

## forja doctor

```bash
forja doctor
```

Ejecuta estas comprobaciones, en este orden:

| Comprobación | Cuándo | Pasa cuando | Si no |
| --- | --- | --- | --- |
| Node.js | siempre | versión 22 o posterior | fail |
| gestor de paquetes | siempre | `<pm> --version` responde (el `pm` de la configuración) | fail |
| Java | backends Java | `java -version` indica JDK 21 o posterior | fail |
| Docker | `db` es `postgres-docker`, o `auth` es `oauth2`, o un proyecto Java con tests de integración | `docker info` responde | fail |
| env | una por cada `.env.example` del proyecto | el `.env` o `.env.local` de al lado tiene todas las claves | warn |
| React | Node, cuando dos o más de la raíz, `apps/web` y `apps/mobile` declaran React | todos declaran la misma versión | fail |
| imports del core | Node | ver abajo | fail |
| Specgate | el extra `specgate` | existen `spec.md` y `docs/specs/traceability.md` | warn |

La comprobación de imports del core lee cada fichero `.ts` y `.tsx` bajo `packages/core/src`. Falla si
alguno importa `next`, `react`, `react-dom`, `react-native` o `expo`, o si un fichero de `domain/`,
`application/` o `ports/` importa desde `infrastructure/`. Nombra el fichero y la línea.

Que falte un `.env` es un aviso, porque el código tiene valores predeterminados. Cada comprobación
fallida o con aviso imprime el comando o la edición que la corrige:

```text
▲  env (root)     no .env yet: the defaults in the code apply
│  cp .env.example .env
```

La última línea lo resume: `Ready`, `Ready, with 1 to look at` o `2 to fix, 1 to look at`.
`forja doctor` sale con código 1 cuando falla al menos una comprobación, y con 0 en otro caso, así que
puedes usarlo en un script.

Se omiten los directorios llamados `node_modules`, `.git`, `.next`, `.expo`, `dist`, `target` y `build`.
