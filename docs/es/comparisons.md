<!-- translation-of: 868cc199d698 -->
# Comparación: `specgate` frente a las alternativas

Este documento sitúa `specgate` con honestidad frente a las herramientas que los
equipos suelen evaluar al adoptar Spec-Driven Development o el scaffolding
asistido por IA: **OpenSpec**, GitHub `spec-kit`, las reglas de Cursor, las
convenciones de Aider y los archivos `README.md` sin más.

OpenSpec es la comparación más cercana y la que merece leerse primero: es el
mejor exponente actual de la idea del ciclo de vida de un change, y varias cosas
de esta herramienta existen gracias a él.

> **Aviso de sesgo.** Esto lo escriben los mantenedores de
> `specgate`. Donde perdemos, lo decimos. Hemos pedido a los mantenedores de
> cada herramienta comparada que lo revisen; sus comentarios (si llegan) se
> citan en notas al pie.

## 1. La matriz de un vistazo

| Capacidad | `specgate` | **OpenSpec** | GitHub `spec-kit` | Cursor `.cursorrules` | Aider `CONVENTIONS.md` | `README.md` sin más |
|---|:-:|:-:|:-:|:-:|:-:|:-:|
| **Genera una estructura inicial de repositorio** | ✅ | ⚠️ mínima | ✅ | ❌ | ❌ | ❌ |
| **Trae un formato de pack de dominio** | ✅ (YAML+schema) | ❌ | ⚠️ ad hoc | ❌ | ❌ | ❌ |
| **Artefactos DDD-lite (agregados, contextos, eventos)** | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **Esqueletos de escenarios Gherkin** | ✅ | ⚠️ escenarios en prosa | ⚠️ vía plantillas | ❌ | ❌ | ❌ |
| **Matriz de trazabilidad** | ✅ completa + legacy | ❌ | ⚠️ básica | ❌ | ❌ | ❌ |
| **Gate de CI `validate`** | ✅ GHA incluido | ✅ | ⚠️ externo | ❌ | ❌ | ❌ |
| **JSON Schema para el DSL** | ✅ draft 2020-12 | n/a (markdown sin más) | ❌ | ❌ | ❌ | n/a |
| **Extensión de VS Code** | ⚠️ construida, no está en el Marketplace | ❌ | ❌ | n/a (editor propio) | ❌ | ❌ |
| **Servidor MCP** | ✅ incluido | ❌ | ❌ | ❌ | ❌ | ❌ |
| **Language server (LSP)** | ✅ incluido | ❌ | ❌ | n/a (editor propio) | ❌ | ❌ |
| **Ciclo de vida del change (propose → apply → archive)** | ✅ incluido | ✅ **la idea fue suya primero** | ❌ | ❌ | ❌ | ❌ |
| **Archive espera a que un test demuestre cada requisito** | ✅ `archive` se niega mientras haya uno pendiente | ❌ las tareas sin marcar preguntan, `--yes` lo salta | ❌ | ❌ | ❌ | ❌ |
| **Trabajar desde tickets de Jira** | ✅ `propose --from-ticket`: Definition of Ready, un PR por ticket | ❌ | ❌ | ❌ | ❌ | ❌ |
| **Comandos que aprender antes del primer PR** | ✅ 6: `init`, `propose`, `apply`, `status`, `archive`, `check` | ✅ 3 slash commands | ✅ | ✅ | ✅ | ✅ |
| **Packs versionados e instalables (`specops`)** | ✅ incluido | ❌ | ❌ | ❌ | ❌ | ❌ |
| **CLI multiplataforma (Windows/Linux/macOS)** | ✅ Node | ✅ Node | ⚠️ muy basado en Bash | ✅ | ✅ | ✅ |
| **Atado a un proveedor de IA** | ❌ | ❌ | ❌ | ✅ Cursor | ❌ | ❌ |
| **Registro de packs descubrible** | ⚠️ el generador existe, aún sin alojar | n/a | ❌ | ❌ | ❌ | n/a |
| **Sin instalación (solo documentación)** | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |
| **Contrato JSON para agentes, documentado y probado** | ✅ generado del código | ✅ escrito a mano | ❌ | ❌ | ❌ | ❌ |
| **Slash commands para herramientas de agentes** | ✅ 11 herramientas (`agents init`) | ✅ | ❌ | n/a | ❌ | ❌ |
| **Grafo de artefactos configurable** | ✅ `specgate schema` | ✅ | ❌ | ❌ | ❌ | ❌ |
| **Compartir especificaciones entre repositorios** | ✅ packs privados | ⚠️ Stores | ❌ | ❌ | ❌ | ❌ |
| **Tiempo hasta el primer valor** | ✅ **< 1 s de CLI, medido**[^ttfv] | ✅ minutos | ✅ minutos | ✅ instantáneo | ✅ instantáneo | ✅ instantáneo |

✅ soportado · ⚠️ parcial / con un rodeo · ❌ no soportado · 🚧 en curso

[^ttfv]: Medido el 2026-08-26 en un repositorio Java nuevo de dos archivos:
    `adopt` + el primer `validate .` — 0,23 s en total, en verde al primer intento.
    Es la sobrecarga propia de la CLI, no una afirmación sobre lo rápido que
    se orienta una persona; esta fila decía antes "⚠️ minutos" como una
    autoevaluación sin medir, y convertirla en un número era algo pendiente. La
    limitación honesta: las columnas de OpenSpec y `spec-kit` no se han
    cronometrado aquí de forma independiente, así que es nuestra cifra junto a
    lo que ellos mismos declaran, no una comparación en igualdad de
    condiciones. Lo que la CLI *no puede* hacer instantáneo, en ninguna de las
    herramientas comparadas: escribir el primer escenario Gherkin real y su
    test es tiempo de una persona, sea cual sea la herramienta.

## 2. Cuándo gana cada herramienta

### `specgate` gana cuando…

- Tu equipo necesita **trazabilidad explícita** entre requisitos, escenarios y
  código (sectores regulados, entregas auditadas).
- Quieres un **modelo de dominio DDD-lite** legible por máquinas para que los
  agentes de IA y las personas compartan el mismo vocabulario.
- Trabajas con **varios entornos** (dev/feature/prod) y quieres scaffolding de
  Docker / devcontainer / `.env` generado y alineado con el dominio.
- Tu trabajo llega como **historias de Jira con criterios de aceptación**: cada
  ticket se comprueba contra una Definition of Ready, se convierte en un change
  en su propia rama y termina como un pull request ([Desde un ticket de
  Jira](from-a-ticket.md)).
- Quieres un flujo **portable y neutral respecto al proveedor** que funcione con
  Claude, Cursor, Aider, Copilot o sin ningún agente.

### OpenSpec gana cuando…

- Quieres **el ciclo de vida del change y nada más**. Las dos herramientas dicen
  ahora propose, apply, archive; el archive de OpenSpec no espera a los tests, y
  es más pequeño, y lo pequeño es una virtud: menos conceptos que enseñar, menos
  que hacer mal.
- Tus especificaciones son **prosa, no un modelo de dominio**. Si agregados,
  comandos y eventos serían ceremonia para tu equipo, nuestros artefactos
  DDD-lite son coste sin beneficio.
- Quieres **markdown sin schema**. Nuestro `pack.yaml` aporta reutilización y
  validación; también aporta un formato que aprender.
- **Empiezas hoy y quieres el camino más corto** hasta un bucle que funcione.

Tomamos de su diseño el formato delta, la gramática `ADDED`/`MODIFIED`/`REMOVED`
y la idea de un contrato de agente auditado. También tomamos sus verbos: desde
[ADR-0035](specs/adr/0035-four-verbs-one-lifecycle.md) el bucle diario es
`specgate propose`, `apply`, `status` y `archive`. Donde nos diferenciamos es a
propósito: `apply` rechaza un requisito que ningún test nombra y lo marca
Implemented solo cuando el gate pasa, `archive` rechaza un change mientras uno
de sus requisitos esté pendiente, y añadimos packs de dominio versionados
(`specops`) y una matriz de trazabilidad que CI hace cumplir. Si no necesitas
esas dos cosas, su superficie más pequeña es la mejor herramienta.

> Su contrato documenta un conjunto de inconsistencias conocidas: snake_case en
> una familia de comandos y camelCase en otra. Tuvimos la ventaja de leerlo
> antes de escribir el nuestro, y elegimos uno. No somos más listos; llegamos
> más tarde.

### GitHub `spec-kit` gana cuando…

- Ya estás metido a fondo en el ecosistema de GitHub y quieres herramientas
  oficiales con una integración más profunda con el repositorio (issues, PRs,
  projects).
- Solo necesitas plantillas ligeras sin vocabulario DDD.
- Prefieres que Microsoft/GitHub gobierne directamente el formato de la
  especificación.

> `spec-kit` avanza deprisa; algunos huecos de arriba se cerrarán. Revísalo cada
> trimestre.

### Cursor `.cursorrules` gana cuando…

- Cursor es tu **única** herramienta de programación con IA y tu equipo se ha
  estandarizado en ella.
- Quieres reglas que orienten el comportamiento del modelo sin cambiar la
  estructura del repositorio ni los tests.

> Te ata a Cursor; no es portable a otros agentes ni a flujos de línea de
> comandos sin más.

### Aider `CONVENTIONS.md` gana cuando…

- Trabajas sobre todo desde el terminal con Aider y quieres un único archivo,
  legible por personas, que el agente lee en cada prompt.
- Tu equipo es pequeño (1–3 ingenieros) y el coste de la trazabilidad formal no
  se justifica.

> Sin imposición estructural: las convenciones derivan con el tiempo sin gates
> de CI.

### `README.md` sin más gana cuando…

- El proyecto es un **prototipo o una prueba de investigación** que quizá no
  sobreviva al trimestre.
- Trabajas solo y el coste de cualquier herramienta supera el coste de olvidar.

> Vale para la semana 1. No escala más allá de la semana 12.

## 3. Cuándo pierde `specgate`

Estas son las concesiones honestas. Preferimos que elijas otra herramienta a que
adoptes la nuestra y te arrepientas.

| Escenario | Qué duele | Recomendación |
|---|---|---|
| **Desarrollador solo, desechable de 1 semana** | El coste de configuración supera la vida del proyecto | Usa un `README.md` + Gherkin en un solo archivo |
| **Equipo solo de Cursor, sin preocupación por la portabilidad** | Nuestra CLI duplica lo que `.cursorrules` ya hace por ellos | Quédate con las reglas de Cursor |
| **Ya en GitHub `spec-kit` desde hace 6+ meses** | Coste del cambio > diferencia marginal de funciones | Espera a que `spec-kit` añada DDD/JSON-Schema; volveremos a publicar esta página |
| **Proyecto solo de front-end sin lógica de dominio** | El vocabulario DDD se siente pesado | Elige el tipo de proyecto `frontend` cuando pregunte el asistente de `init`, pero plantéate plantillas sin más |
| **Empresa muy conservadora, sin Node.js permitido** | Exigimos Node ≥ 22 en tiempo de ejecución | Ejecuta la imagen Docker publicada, o el plugin de Maven / Gradle, que lanzan la CLI por ti |
| **Odias YAML** | El formato de pack es YAML | No publicaremos packs en JSON/TOML en 0.x; lo revisaremos en 1.0 |

## 4. Caminos de migración

### De OpenSpec → `specgate`

El formato delta es el mismo a propósito, así que las especificaciones pasan tal
cual.

1. `specgate init` en el repositorio: lo adopta y nunca sobrescribe un archivo existente.
2. Mueve `openspec/changes/<id>/` a `docs/specs/changes/<id>/` y añade un
   `change.yaml` (`specgate propose <id>` escribe uno que puedes copiar).
3. Mueve `openspec/specs/<capability>/spec.md` a
   `docs/specs/capabilities/<capability>/spec.md`.
4. `specgate change validate`: la gramática `ADDED`/`MODIFIED`/`REMOVED` es
   compatible; lo que marcará son las palabras clave RFC-2119 que falten y los
   pasos de escenario que sean prosa en lugar de viñetas `- GIVEN`.
5. Añade un comentario `<!-- specgate:trace kind=functional -->` a cada
   requisito (`functional`, `non-functional` o `business-rule`):
   `change approve` rechaza un requisito sin `kind=`. `uc=… cmd=…` en el mismo
   comentario son opcionales; sin ellos un requisito se archiva igualmente, con
   `-` en esas columnas de la matriz.
6. Para cada change abierto: una persona lo aprueba (`specgate change approve
   <id>`, en un terminal), después un test que nombre cada uno de sus
   requisitos, `specgate apply` hasta que cada uno esté Implemented, y luego
   `specgate archive <id>`. Un change abierto que OpenSpec archivaría con tareas
   sin marcar sigue abierto aquí hasta que sus tests pasen.

**No migres** si lo que valorabas era la superficie más pequeña. Los pasos 4 y 5
son el peaje de la matriz y del gate de CI; si no quieres eso, no quieres esta
herramienta.

### De `spec-kit` → `specgate`

1. Ejecuta `npx @rsaglobaltech/specgate@latest init --config specgate.yaml --out ./next`
   (un archivo YAML con las respuestas del asistente; sin `--config` el asistente pregunta).
2. Copia tus artefactos de `spec-kit` en el `docs/specs/` generado.
3. Ejecuta `specgate check`: te dirá lo que falta en la matriz de trazabilidad.
4. Mantén `spec-kit` funcionando durante 1 ciclo de versión como comprobador en paralelo.

### De `.cursorrules` → `specgate`

1. Genera un proyecto con `specgate init`.
2. Mueve tus reglas de Cursor a `AGENTS.md`, debajo del bloque que Specgate mantiene ahí.
3. Referencia la matriz de trazabilidad generada desde tus reglas para que Cursor
   la lea en cada prompt.

### De `README.md` sin más → `specgate`

1. Genera un proyecto como arriba.
2. Copia el README existente en `docs/specs/glossary.md`.
3. Opcionalmente, `specgate pack init --out ./domain-packs --name "<your domain>"`
   escribe un esqueleto de pack de dominio vacío; rellénalo con los requisitos de
   tu lista de módulos.

## 5. Preguntas que merece la pena hacerse antes de elegir

1. **¿Usará esto mi equipo dentro de 12 meses?** Las herramientas que exigen
   disciplina mueren. Las que tienen un gate de CI sobreviven.
2. **¿Existirá mi agente de IA preferido dentro de 12 meses?** Atarse a un
   proveedor sale caro cuando el proveedor cambia de rumbo o cierra.
3. **¿Me importan los registros de auditoría?** Si es así, la matriz de
   trazabilidad y las especificaciones validadas por schema no son negociables.
4. **¿Necesito coherencia entre equipos?** Si es así, un formato de pack
   versionado gana a las convenciones en prosa.
5. **¿Cuánto cuesta equivocarse?** Las cuatro alternativas son reversibles en
   <1 día; elige la que te deje experimentar más barato.

## 6. Referencias

- [Caso de estudio 1: adopción de Smart Parking sobre código existente](case-studies/case-1.md)
- [OpenSpec](https://github.com/Fission-AI/OpenSpec) (revisado por última vez en 2026-08) — la referencia que dio forma al ciclo de vida del change de esta herramienta; el análisis completo está en las notas de los mantenedores
- [GitHub spec-kit](https://github.com/github/spec-kit) (revisado por última vez en 2026-05)
- [Documentación de Cursor `.cursorrules`](https://docs.cursor.com/context/rules-for-ai)
- [Guía de Aider CONVENTIONS.md](https://aider.chat/docs/usage/conventions.html)

Nuestra propia columna se verificó por última vez contra la CLI publicada el
**2026-08-16**; la fila de Jira, el recuento de herramientas de agentes y los
comandos de migración contra 0.22.0 el **2026-10-20**. La fila "Tiempo hasta el
primer valor" se volvió a medir el **2026-08-26** (mira la nota al pie).
OpenSpec se revisó en **2026-08**; las demás columnas en **2026-05**.
Los pull requests con correcciones son bienvenidos: mira
[CONTRIBUTING.md](../../CONTRIBUTING.md).

## Siguiente

- [Specgate u OpenSpec](vs-openspec.md) — la comparación más cercana, en detalle
- [Empezar](getting-started.md) — instálalo y elige tu camino
