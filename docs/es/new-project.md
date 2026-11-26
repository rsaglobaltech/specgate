<!-- translation-of: 5dcabf3c1acd -->
# Un producto nuevo, paso a paso

Esta página es el orden de trabajo para un producto nuevo, desde el brief de un
cliente hasta un producto que funciona y un gate que lo sostiene. Seis
productos reales siguieron este camino: una app de reservas, una tienda con
crédito, un sistema de banca central, una plataforma de operaciones de eventos,
un gestor de casos clínicos y una app de campo para una cuadrilla de ferralla.
Fueron los mismos doce pasos cada vez. Tres son tuyos y no se pueden delegar:
leer el brief (1), revisar cada borrador (8) y usar el producto (12). Un agente
de código puede hacer el resto.

Los detalles de cada paso viven en otras guías; esta es el orden. El
[studio](studio.md) recorre el mismo orden como una app, desde la carpeta vacía
hasta el informe.

**Necesitas:** Node.js 22 o posterior, git, el brief del cliente y un agente de
código si quieres que escriba los borradores. Los comandos se escriben como
`npx specgate`, que ejecuta la copia instalada en el proyecto en el paso 3. En
un proyecto sin `package.json`, escribe `npx @rsaglobaltech/specgate@latest` en
su lugar.

## Una vez por proyecto

### 1. Lee el brief: separa el qué del cómo

Un brief mezcla lo que hace el sistema con cómo construirlo. Tres de los seis
briefs eran sobre todo arquitectura: microservicios, Kafka, event stores, CQRS.
Los requisitos salen del _qué_; el _cómo_ es una decisión técnica. Acuerda el
alcance antes de escribir nada. En todos los pilotos el acuerdo fue ignorar la
infraestructura pero entregar lo que prometía: "reconstruir lo que pasó" se
convirtió en un requisito ("la agenda tal como era en cualquier fecha"), no en
un producto que instalar.

### 2. Crea el proyecto

Specgate no genera código de aplicación; adopta un proyecto que ya compila. Usa
el scaffold de tu propio framework, o forja, la herramienta compañera de
Specgate, que genera una aplicación TypeScript o Java con la arquitectura en su
sitio ([forja: Empezar](forja/getting-started.md)). Después `git init` y un
repositorio.

### 3. Adopta Specgate

```bash
npm install --save-dev @rsaglobaltech/specgate
npx specgate init --no-capabilities        # a new project: no proposals from folders
npx specgate config set test_cmd "<cmd>"   # the tests `check` and `apply` run
# a test named "REQ-001 SCN-001: the application starts", then:
npx specgate apply REQ-001                 # the adoption baseline
npx specgate ci status                     # init wrote the gate for CI: what it checks
```

`init` detecta el stack y propone el comando de test (`npm test`,
`./mvnw -B test`, `./gradlew test`). También escribe `REQ-001 — Existing
behaviour is preserved`, la baseline de adopción, y `apply REQ-001` la rechaza
(`apply_no_test`) hasta que un test nombre `REQ-001` y su escenario `SCN-001`.
Haz que ese sea el test que arranca la aplicación real sin dobles de test, sobre
todo en un proyecto Spring o Quarkus: en un piloto la aplicación no arrancó
durante un módulo entero mientras todos los tests, y CI, estaban en verde.

### 4. Guarda el brief en el repositorio

Guárdalo como `docs/brief.md`, sin cambios, con un front matter que nombre el
producto, quién lo usa y cómo, y los módulos:

```markdown
---
product: Event operations
surfaces: [api]
actors:
  - { name: Organizer, surfaces: [api] }
  - { name: Attendee, surfaces: [api] }
modules: [events, registration, logistics, access, reports]
---
```

Los actores deciden lo que pide la lista de comprobación, así que revísalos: los
briefs rara vez los nombran (un "operador", un "comercio", un "responsable de
privacidad" se dedujeron todos). Mira [Desde el brief de un
cliente](from-a-brief.md).

## Una vez por módulo

### 5. Abre el borrador

```bash
npx specgate propose --from-brief            # the brief's modules, and the next one
npx specgate propose --from-brief <module>   # opens it, linked to the brief, with DRAFTING.md
```

Antes del primer módulo, `npx specgate propose --from-brief --check` comprueba
el propio brief: sus campos y, cuando tiene secciones `## Module:`, una por
módulo con reglas y ejemplos. Un brief en texto libre bajo su front matter
también se redacta, y cada módulo lee el texto entero
([Escribe el brief](start/write-the-brief.md)).

Un módulo por borrador: quien revisa lee diez requisitos, no sesenta
(`--reserve 12` para uno más grande).

### 6. Escríbelo

Dile a tu agente `Draft the <module> module: follow
docs/specs/changes/draft-<module>/DRAFTING.md`, o ejecuta
`npx specgate propose --from-brief <module> --agent "claude -p"`. El agente
escribe `specs/<module>/spec.md` y dos archivos a su lado:

- **`assumptions.md`**: cada valor que el brief no da, y los requisitos que lo
  usan (ids uno a uno o como rangos). Calcula los valores antes de escribirlos:
  un IBAN, un número de tarjeta o una letra de documento inventados a mano
  costaron un test en rojo en los pilotos.
- **`questions.md`**: lo que solo el cliente puede responder, y lo que bloquea
  cada pregunta. Una propuesta ("envío gratis a partir de 50 €, por validar") es
  una respuesta; "por decidir" no lo es.

Dale a cada actor un escenario que **encuentre** aquello sobre lo que luego
actúa: la lista de transferencias pendientes, de sesiones en borrador, de
resultados por revisar. Es el hueco que encontraron todos los pilotos al
ejecutar el producto.

### 7. Compruébalo

```bash
npx specgate propose --from-brief <module>
```

Volver a ejecutarlo sobre el borrador abierto pasa la lista de comprobación de
redacción, las reglas D: un escenario por requisito y por superficie, valores
que vienen de algún sitio, leyes con su fuente, preguntas abiertas que
bloquean, ids que no chocan, y un actor que puede obtener cada id sobre el que
actúa. Una primera pasada suele tener hallazgos; cada uno es una frase que
añadir o un valor que declarar. Mira la tabla en [Desde el brief de un
cliente](from-a-brief.md#3-comprueba-el-borrador).

### 8. Revísalo: una persona

La lista de comprobación ve la forma, no el negocio. Lee los requisitos, los
supuestos y las preguntas. Lleva las preguntas al cliente y escribe cada
respuesta en la columna `Answer`. Una respuesta no cambia ningún requisito por
sí sola: hasta que el texto y los escenarios del requisito lo digan y su estado
`Needs Clarification` haya desaparecido, `propose --from-brief <module>` lo
señala y `status` lo lista en "Answered — update the spec". `--agent` lo hace
por ti.

Una pregunta que no te toca responder a ti se queda abierta:

```markdown
<!-- specgate:trace actor=Operator kind=functional status="Needs Clarification" -->
```

El requisito entonces espera: `status` lo lista en "Waiting for an answer",
`apply` lo rechaza y el harness no lo construirá. En el piloto clínico las
alertas de interacción entre fármacos se quedaron ahí: nadie puede inventar esa
tabla.

Cuando lo hayas leído, aprueba el borrador tú, en tu terminal:
`npx specgate change approve draft-<module>`. Un agente no puede, y `apply`
rechaza un requisito de un change que nadie aprobó (`change_not_approved`).

### 9. Construye cada requisito, primero el test

El borrador revisado sigue siendo un change abierto mientras lo construyes:
`status` lista sus requisitos y `apply` juzga cada uno como quedará tras el
archive. El test nombra el requisito y el escenario (`REQ-012 SCN-018: …` en el
nombre del test): esa mención es el enlace. Después:

```bash
npx specgate apply REQ-012            # refused while no test names it, or the suite is red
# … the code …
npx specgate apply REQ-012 REQ-013    # several at once: the tests run once
```

O deja que lo haga el agente: `npx specgate harness run`, un worktree por
requisito, el mismo gate.

### 10. Archívalo

```bash
npx specgate archive draft-<module>
```

Un borrador se archiva cuando su código está terminado: cada requisito que añade
está Implemented, o `archive` se niega y nombra el siguiente
`specgate apply REQ-…`. Los requisitos pasan a `docs/specs/capabilities/` y se
escribe un archivo feature por requisito (en español cuando los escenarios lo
están). Un requisito que aún espera respuesta mantiene abierto el borrador;
muévelo a un change posterior si el resto debe salir antes.

### 11. Antes de cada push

```bash
npx specgate check     # the specification, then the tests; CI runs the same
```

### 12. Usa el producto

Arráncalo, como lo haría un usuario, después de cada módulo. El gate demuestra
que lo que dice la especificación es cierto; no puede ver lo que la
especificación no dice. En los seis pilotos, ejecutar el producto encontró:

- una acción cuyo actor no podía encontrar sobre qué actuar (ahora D12),
- un requisito más amplio que su único escenario ("cada error tiene esta forma"),
- un build de producción o un contexto de aplicación que no arrancaba,
- un agujero de privacidad: una búsqueda que devolvía datos clínicos sin dejar
  rastro.

Cada hueco se convierte en un change corto —`npx specgate propose <module>-2 --capability
<module>`, después los pasos 8 a 10—. `--capability` dirige el delta a la
capacidad del módulo; sin él, el delta apunta a una capacidad nueva llamada
`<module>-2`. Cuando el change reescribe un requisito entregado, ponlo en
`## MODIFIED Requirements` con todos sus escenarios y vuelve a aplicarlo contra
el nuevo escenario: el change solo se archiva cuando está Implemented, y
archivar regenera su archivo feature.

## El día a día, en resumen

Cuando los primeros módulos están construidos, el trabajo nuevo llega como un
change que describes o como un ticket de Jira:

```bash
npx specgate propose <change-id>          # a change: a delta to write, REQ ids reserved
npx specgate propose --from-ticket <KEY>  # or a Jira story: see From a Jira ticket
npx specgate change approve <change-id>   # a person, at a terminal, after reading the delta
npx specgate apply                        # the next requirement through the gate
npx specgate status                       # what each requirement still needs, and what waits for an answer
npx specgate archive <change-id>          # once every requirement in it is Implemented
npx specgate check                        # the same gate, in CI
```

El camino del ticket, incluido el pull request por ticket, está en
[Desde un ticket de Jira](from-a-ticket.md).

## Los pilotos

Cada página de proyecto dice qué funcionó, qué hizo mal Specgate y qué se corrigió:

- [Rebar Crew](projects/rebar-crew.md) — el primer producto, antes de que existiera la lista de comprobación de borradores
- [Bookings](projects/bookings.md) — un brief detallado; la primera lista de comprobación de borradores
- [Credit shop](projects/credit-shop.md) — un brief de cinco líneas: casi todos los valores fueron supuestos
- [FinCore](projects/fincore.md) — Spring Boot; Specgate en un stack de la JVM
- [EventTech](projects/eventtech.md) — Quarkus, event sourcing, tiempo real; el primer uso de D12
- [HealthTech](projects/healthtech.md) — un dominio regulado: lo que no se sabe espera una respuesta

## Siguiente

- [Desde el brief de un cliente](from-a-brief.md) — los pasos 4 a 10 en detalle
- [Escribe el brief](start/write-the-brief.md) — el front matter del brief, campo a campo
