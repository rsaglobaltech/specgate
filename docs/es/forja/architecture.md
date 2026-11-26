<!-- translation-of: 40e13cedc00c -->
# Arquitectura

Todo proyecto que genera forja es hexagonal, lo que también se llama puertos y adaptadores. Detrás hay
una sola regla: las dependencias apuntan hacia el dominio. Las reglas de negocio no saben nada del
framework web, de la base de datos ni del proveedor de correo, y esas piezas se enchufan desde fuera.

```text
infrastructure  ──►  application  ──►  domain
 (framework,          (use cases,        (entities, value objects,
  database, HTTP,      ports)             rules: plain code)
  security)
```

## Las capas

| Capa | Qué contiene | Node: `packages/core/src/` | Java: `apps/api/.../<module>/` |
| --- | --- | --- | --- |
| Dominio | entidades, value objects, eventos, las reglas | `domain/` | `domain/` |
| Aplicación | casos de uso, uno por clase | `application/<module>/` | `application/` |
| Puertos | las interfaces que necesitan los casos de uso | `ports/` | `application/port/` |
| Infraestructura | los adaptadores y la raíz de composición | `infrastructure/` | `infrastructure/` |

En Node, el hexágono es el workspace `packages/core`, compartido por las apps web y móvil. En Java, cada
módulo de `apps/api` es su propio hexágono pequeño (`tasks` para empezar), más un paquete `shared` para
las piezas transversales como `DomainException` y el puerto `CurrentUser`.

### Dominio

TypeScript plano o Java plano: sin framework, sin base de datos, sin HTTP. Una entidad se crea con una
factoría, como `User.create` o `Task.create`. Los value objects como `Email`, `Password` y `TaskTitle`
rechazan la entrada inválida al construirse, así que el resto del código puede fiarse de ellos.

### Aplicación

Un caso de uso orquesta el dominio a través de puertos. Todo lo que necesita del mundo exterior, como
un repositorio, un reloj, un hasher de contraseñas o un mailer, le llega por el constructor como una
interfaz. Eso es lo que permite que los tests ejecuten un caso de uso contra adaptadores en memoria, sin
arrancar nada.

En Java, los casos de uso no llevan anotaciones del framework. `CompleteTask` es una `final class`
plana con un constructor.

### Infraestructura

Los adaptadores implementan los puertos: repositorios Drizzle y en memoria, bcrypt, un mailer de
consola y un reloj del sistema en Node; repositorios JDBC y en memoria, controladores REST y seguridad
JWT en Java. La infraestructura es también donde se ensamblan las piezas.

## La raíz de composición

Un único sitio conoce tanto los casos de uso como los adaptadores, y los conecta.

En Node es `packages/core/src/infrastructure/config/container.ts`. `buildContainer()` crea los
adaptadores y devuelve un objeto con cada caso de uso construido sobre ellos. Cada adaptador se elige con
su propio interruptor: `hasDatabase()` elige los repositorios Drizzle cuando `DATABASE_URL` está
definida y los de memoria en otro caso. No hay un único flag de "modo demo" que lo apague todo a la vez.
El contenedor se guarda en `globalThis`, así que los distintos bundles de servidor de Next.js comparten
una instancia y un único conjunto de datos en memoria.

En Java es una clase `<Module>Configuration` en el `infrastructure/config` de cada módulo:
`TasksConfiguration` declara métodos `@Bean` de Spring, o métodos `@Produces` de CDI en Quarkus, que
llaman a los constructores de los casos de uso.

`forja add usecase` registra los casos de uso nuevos en ese mismo sitio: en `buildContainer()` en Node,
y en `<Module>Configuration` en Java. Consulta [Uso diario](daily-use.md).

## Qué comprueba ArchUnit

En Java con ArchUnit activado (lo predeterminado), `ArchitectureTest` se ejecuta en cada `./mvnw verify`
y hace fallar el build cuando se rompe una de estas reglas:

| Regla | Qué dice |
| --- | --- |
| `domainIsPureJava` | nada en `..domain..` depende de `..application..`, `..infrastructure..` ni del framework |
| `applicationHasNoFrameworkNorAdapters` | nada en `..application..` depende de `..infrastructure..` ni del framework |
| `portsAreInterfaces` | toda clase en `..application.port..` es una interfaz |
| `modulesDoNotUseEachOthersInfrastructure` | la `infrastructure` de un módulo no depende de la de otro módulo |
| `noCycles` | no hay ciclos de dependencias entre módulos |

"El framework" significa `org.springframework..`, `jakarta..` e `io.swagger..` en Spring Boot, e
`io.quarkus..`, `jakarta..`, `org.eclipse.microprofile..` e `io.smallrye..` en Quarkus. Las clases de
test no se analizan.

## Qué comprueban npm run arch y forja doctor en Node

Node no tiene ArchUnit, así que el proyecto generado lleva `scripts/check-architecture.mjs`, que se
ejecuta con `npm run arch`, y `forja doctor` ejecuta la misma comprobación. El script no tiene
dependencias, así que funciona donde funcione el proyecto, y el gate de Specgate lo ejecuta como
`arch_cmd`. Ambos comprueban los imports del core. Lee cada fichero `.ts` y `.tsx`
bajo `packages/core/src` y falla cuando:

- algún fichero importa `next`, `react`, `react-dom`, `react-native` o `expo`, o una subruta suya;
- un fichero de `domain/`, `application/` o `ports/` importa desde `infrastructure/`.

Nombra el fichero y la línea, y sugiere mover ese código a `apps/*` o a `infrastructure/` y llegar a él
a través de un puerto. También comprueba que la raíz, la app web y la app móvil declaran una sola
versión de React, porque dos copias rompen los hooks. [Uso diario](daily-use.md#forja-doctor) lista el
resto.

## Errores esperados como valores

En Node, un caso de uso devuelve un `Result` para los errores que el negocio espera:

```ts packages/core/src/domain/shared/Result.ts
export type Result<T, E> = { ok: true; value: T } | { ok: false; error: E };
```

`RegisterUseCase` devuelve `err(new EmailAlreadyInUseError())` cuando el email ya está cogido, y
`ok({ userId })` cuando no. Los motivos:

- La firma dice qué puede salir mal. `Result<RegisterOutput, EmailAlreadyInUseError>` le dice al
  llamante qué errores debe tratar; una excepción lanzada no aparece en el tipo.
- El llamante tiene que mirar `ok` antes de poder llegar a `value`, así que un fallo esperado no puede
  colarse sin tratar.
- Cada error de dominio tiene un `code` estable, como `EMAIL_ALREADY_IN_USE`, que la app web y la app
  móvil pueden traducir a un mensaje.

Los fallos que nadie espera, como que la base de datos esté caída, siguen lanzando excepciones. No son
parte del negocio, y ningún llamante puede hacer mucho con ellos. Los value objects también lanzan al
construirse con entrada inválida: `Email.create` lanza un `InvalidEmailError`, que es un `DomainError`
con su propio `code`. Las Server Actions y los route handlers de la API de la app web validan la entrada
con los esquemas zod de `packages/shared` antes de que llegue al core.

Los casos de uso que escribe `forja add` siguen la misma forma: `execute()` devuelve
`Promise<Result<...>>`, y el test comprueba `result.ok`.

En Java el código generado sigue el camino habitual del lenguaje: una regla rota lanza una
`DomainException` con un `code` estable y un tipo (inválido, no encontrado, conflicto, prohibido), y la
capa web la convierte en una respuesta RFC 9457 Problem Details que lleva ese `code`.

## Un test que lo arranca todo

La mayoría de los tests sustituyen piezas por dobles. Los proyectos Java también reciben `StartupTest`,
que arranca la aplicación con sus piezas reales. Demuestra que los adaptadores reales existen y están
conectados, algo que una suite de tests unitarios en verde no puede demostrar.
