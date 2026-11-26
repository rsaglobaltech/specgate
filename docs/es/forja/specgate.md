<!-- translation-of: 95ccc6e69d06 -->
# forja y Specgate

[Specgate](../getting-started.md) mantiene sincronizados los requisitos de un proyecto, sus escenarios
y los tests que los demuestran. forja puede generar un proyecto preparado para él, y `forja add
usecase` enlaza cada caso de uso nuevo con su requisito. Esta página cubre lo que hace forja; la
documentación de Specgate cubre Specgate en sí.

## Activarlo

Specgate llega con el extra `specgate`. Está activado por defecto en los backends Java. En Node, pídelo:

```bash
forja init acme --yes --extras lint,specgate
forja init shop --yes --backend spring          # lint, docker and specgate by default
```

En el asistente, marca "Specgate (spec-driven development)" en Extras.

## Qué instala forja

| Qué | Dónde |
| --- | --- |
| `@rsaglobaltech/specgate`, en la versión que fija forja | `package.json` raíz, `devDependencies` |
| Los scripts `spec`, `spec:status`, `spec:check` | `package.json` raíz, que ejecutan `specgate`, `specgate status` y `specgate check` |
| El brief que hay que rellenar | `docs/brief.md` |
| La guía del día a día | `docs/specgate.md` |

`docs/brief.md` empieza con cuatro campos para Specgate y después un espacio para el brief del cliente:

```yaml docs/brief.md
---
product: acme
surfaces: [api, web]
actors:
  - { name: Customer, surfaces: [api, web] }
modules: []
---
```

Pega el brief debajo de ese bloque tal como lo recibiste. Specgate comprueba que cada valor de un
escenario sale de este texto o de `assumptions.md`.

## Adopción después de la instalación

Cuando forja instala las dependencias, adopta Specgate en el proyecto nuevo:

```bash
npx specgate adopt --no-capabilities
npx specgate config set test_cmd "npm test"
npx specgate config set arch_cmd "npm run arch"
```

La tercera línea mete la arquitectura en el gate: `specgate check`, `specgate apply` y el harness
ejecutan `npm run arch` entre la especificación y los tests, así que el código en la capa equivocada
hace fallar el gate aunque pasen todos los tests. En Node, `npm run arch` comprueba las reglas de
imports del core; en Java ejecuta solo el test de ArchUnit. Necesita Specgate 0.20 o posterior; uno más
antiguo deja el gate como estaba.

Con git activado, hace commit del resultado como `chore: adopt Specgate`. Si usaste `--skip-install`, o
la adopción falló (sin red, por ejemplo), forja imprime esos comandos entre los siguientes pasos en su
lugar. En ambos casos, los siguientes pasos terminan con:

```bash
npx specgate propose --from-brief   # after you fill in docs/brief.md — see docs/specgate.md
npx specgate          # where the specification stands, and what to run next
```

`forja doctor` avisa hasta que el proyecto está adoptado, cosa que detecta por la presencia de
`spec.md` y `docs/specs/traceability.md`.

### Pasar al Specgate actual

Los pasos de abajo usan los cuatro verbos (`propose`, `apply`, `status`, `archive`), que necesitan
Specgate 0.21 o posterior. Comprueba la versión que fijó forja en el `package.json` raíz; si es más
antigua, pasa el proyecto a la versión actual:

```bash
npm install --save-dev @rsaglobaltech/specgate@latest
```

## Módulo a módulo

El flujo de abajo es el del `docs/specgate.md` generado. Ejecuta `npx specgate` solo siempre que
pierdas el hilo: muestra dónde está la especificación y el comando que hay que ejecutar a continuación.

1. **Escribe el brief.** Pega el brief del cliente en `docs/brief.md` y rellena los cuatro campos y
   una sección por módulo. `npx specgate propose --from-brief` explica cada campo;
   `npx specgate propose --from-brief --agent "claude -p"` deja que tu agente los proponga;
   `npx specgate propose --from-brief --check` comprueba el brief.
2. **Redacta un módulo.** Tu agente escribe los requisitos y los escenarios, y Specgate los comprueba
   contra el brief:

   ```bash
   npx specgate propose --from-brief orders --agent "claude -p"
   ```

   Sin agente, `npx specgate propose --from-brief orders` imprime la línea que hay que pegarle a uno.
   Repite hasta que diga *Ready to review*.
3. **Revísalo** con quien conozca el negocio. Las preguntas abiertas van al cliente. El borrador sigue
   siendo un change abierto mientras lo construyes.
4. **Construye cada requisito, primero el test.** Un test que nombra `REQ-007` es el enlace. `forja add
   usecase` escribe por ti el caso de uso y ese test; consulta la sección siguiente.
5. **Aplica cada requisito.** Specgate se niega mientras ningún test lo nombre o la suite esté en rojo,
   y lo marca como Implemented cuando el gate pasa:

   ```bash
   npx specgate apply REQ-007
   ```

6. **Archiva el módulo** cuando todos sus requisitos estén en Implemented. `archive` se niega antes de
   eso; fusiona los requisitos en la especificación, en tu rama, antes de la pull request:

   ```bash
   npx specgate archive draft-orders
   ```

7. **Antes de cada pull request**, ejecuta el gate:

   ```bash
   npx specgate check
   ```

Cuando el trabajo llega como historias de Jira en lugar de un brief, cada ticket abre su propio change
con `npx specgate propose --from-ticket <KEY>`; los pasos de construir, aplicar y archivar son los
mismos. Consulta [Desde un ticket de Jira](../from-a-ticket.md).

Cada módulo de la especificación es un módulo hexagonal del código: `application/<module>/` en
`packages/core` en Node, `apps/api/.../<module>/` en Java.

## forja add usecase con Specgate

En un proyecto donde Specgate está adoptado, `forja add usecase` también crea el requisito:

```bash
forja add usecase orders/PlaceOrder
```

1. forja comprueba primero que no se sobrescribiría ningún fichero, así que un comando rechazado no
   deja ningún requisito huérfano.
2. Ejecuta `specgate new "Place order"`. El título sale del nombre de la clase, o de `--title`.
3. Escribe el caso de uso y su test, con el id nuevo en el nombre del test:

   ```ts PlaceOrderUseCase.test.ts
   describe("REQ-003 Place order", () => {
     it("runs", async () => { /* ... */ });
     it.todo("proves the scenario in <the feature file Specgate wrote>");
   });
   ```

   En Java, el id va en `@DisplayName("REQ-003 Place order")`, y el escenario pendiente es un test
   `@Disabled`. El comentario del caso de uso dice `Specified by REQ-003`.
4. Ejecuta `specgate matrix` para regenerar la matriz de trazabilidad, así `specgate check` ve el
   enlace.

La salida nombra el requisito, el fichero del escenario cuando Specgate informa de uno, y el siguiente
paso:

```text
◇  REQ-003 · Place order
│  scenario to write: <the feature file>
└  Next: write the scenario, make the test prove it (npm test), then npx specgate done REQ-003
```

forja 1.0.0 imprime el nombre antiguo del comando. Ejecuta `npx specgate apply REQ-003` en ese último
paso.

### Las opciones

| Opción | Efecto |
| --- | --- |
| `--req REQ-007` | nombra un requisito existente en lugar de crear uno. El id debe tener la forma `REQ-` seguido de dígitos. |
| `--title "Place an order"` | el título que recibe `specgate new`, y el del nombre del test |
| `--no-spec` | ni requisito ni id en el test |
| `--dry-run` | muestra los ficheros; no crea ningún requisito |

`--req` sirve para requisitos que salieron de `specgate propose --from-brief`: el módulo archivado ya
tiene `REQ-007` y quieres el código para él.

```bash
forja add usecase orders/PlaceOrder --req REQ-007
```

Si Specgate no puede escribir el requisito, forja escribe igualmente los ficheros y avisa con
`No requirement linked:` y el motivo.

## En CI

Con el extra `ci` también, el workflow de GitHub Actions generado tiene un job `spec` que ejecuta
`validate . --strict` con la versión de Specgate que fijó forja. Los tests en sí se ejecutan en los
otros jobs.
