<!-- translation-of: 119fb30da435 -->
<!-- specgate:allow-placeholders — this file documents the {{VAR}} template syntax. -->
# 🚗 Tutorial de principio a fin — construyendo **Smart Parking**

Un recorrido paso a paso por los comandos que más usas en
`specgate`, y por muchos de los demás. Construimos un proyecto backend real —**Smart
Parking**— sobre el pack de demostración público
[`rsaglobaltech/parking-management-specops`](https://github.com/rsaglobaltech/parking-management-specops).

**No** necesitas entender toda la herramienta de entrada. Cada paso
explica primero el _concepto_, después el comando y después lo que deberías ver.

> Si no has instalado la CLI de forma global, sustituye cada `specgate` de
> esta guía por `npx @rsaglobaltech/specgate@latest`.
>
> **Este tutorial sigue los packs de dominio.** Para trabajar a partir del brief de un cliente, consulta
> [A partir del brief de un cliente](from-a-brief.md) y el recorrido
> [Desde cero](start/scratch-1-install.md): `specgate propose
> --from-brief` convierte el brief en requisitos módulo a módulo. Para trabajar
> a partir de un ticket de Jira, consulta [Desde un ticket de Jira](from-a-ticket.md). Todo
> a partir del Paso 3 vale para los tres.
>
> **El bucle diario son cuatro verbos**: `propose` abre un change, `apply` entrega
> un requisito a través del gate, `status` dice lo que queda, y `archive`
> cierra el change cuando su código está terminado. `init` se ejecuta una vez; `check` es el
> mismo gate en CI. Los pasos 3–6 los recorren todos.

---

## Antes que nada: los dos sitios donde trabajarás

Esta es la idea más importante de la herramienta, y la que más
confunde. Hay **dos carpetas separadas** en tu disco, y no son
lo mismo:

```text
┌─────────────────────────────────────┐     ┌─────────────────────────────────────┐
│  THE PACK REPO                      │     │  YOUR IMPLEMENTATION PROJECT        │
│  parking-management-specops/        │     │  smart-parking/                     │
│                                     │     │                                     │
│  • pack.yaml  (the domain model)    │     │  • spec.md                          │
│  • templates/ (Gherkin templates)   │     │  • features/**/*.feature            │
│                                     │ ──▶ │  • docs/specs/traceability.md       │
│  Reusable knowledge, versioned      │     │  • src/, test/  (the code YOU write)│
│  with git tags (v0.1.0, v0.2.0…).   │     │  • .specops.lock  ← the link        │
│  You only open this if you AUTHOR   │     │                                     │
│  packs.                             │     │  Where you spend 95% of your time.  │
└─────────────────────────────────────┘     └─────────────────────────────────────┘
        the SOURCE of specs                       the project that CONSUMES them
```

- El **repo del pack** es una biblioteca de conocimiento de dominio. Piensa en él como un
  paquete de npm: normalmente solo _consumes_ una versión publicada,
  no lo editas.
- Tu **proyecto de implementación** es la app que estás construyendo. Es un
  repo git normal con tu código fuente real. `init` lo creó; `expand` /
  `specops add` copiaron specs renderizadas _dentro_ de él; y `.specops.lock` (un archivo
  **dentro de tu proyecto**) recuerda de qué pack y versión vienen.

**La regla práctica:** salvo que un paso diga expresamente «el repo del pack», ejecutas
el comando **desde dentro de tu proyecto de implementación**
(`smart-parking/`). Cada paso de abajo lleva una insignia 📍 para que nunca tengas
dudas.

| Lo ejecutas desde…                                    | Estos comandos                                                                                                                          |
| ----------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| 📍 tu **proyecto de implementación** (`smart-parking/`) | `init`\* · `propose` · `apply` · `status` · `archive` · `check` · `specops add` · `specops diff` · `specops sync` · `specops remove` · `change` · `harness run` |
| 📦 el **repo del pack** (`parking-management-specops/`) | `pack init` · `pack lint` · `pack lint --graph` · `pack infer` · y «añadir un requisito como autor de un pack»                          |

\* `init` se ejecuta desde el directorio _padre_: _crea_ la carpeta del
proyecto. Después entras en ella con `cd` y te quedas ahí.

---

## Índice

1. [Requisitos previos](#1-requisitos-previos)
2. [Paso 1 — Crea el proyecto (`init`)](#2-paso-1-crea-el-proyecto-init)
3. [Paso 2 — Aplica el pack de dominio (`specops add`)](#3-paso-2-aplica-el-pack-de-dominio-specops-add)
4. [Paso 3 — Ejecuta el gate (`check`)](#4-paso-3-ejecuta-el-gate-check)
5. [Paso 4 — Mira lo que queda por construir (`status`)](#5-paso-4-mira-lo-que-queda-por-construir-status)
6. [Paso 5 — Implementa un requisito y entrégalo (`apply`)](#6-paso-5-implementa-un-requisito-y-entregalo-apply)
7. [Paso 6 — Añade un requisito NUEVO (`propose` · `archive`)](#7-paso-6-anade-un-requisito-nuevo-propose-archive)
8. [Paso 7 — Actualiza la versión del pack (`specops diff` + `specops sync`)](#8-paso-7-actualiza-la-version-del-pack-specops-diff-specops-sync)
9. [Paso 8 — Quita un pack (`specops remove`)](#9-paso-8-quita-un-pack-specops-remove)
10. [Paso 9 — Crea tu propio pack (`pack init` · `lint` · `--graph` · `infer`)](#10-paso-9-crea-tu-propio-pack)
11. [Paso 10 — Añade un requisito NUEVO (como autor de un pack)](#11-paso-10-anade-un-requisito-nuevo-como-autor-de-un-pack)
12. [Paso 11 — Cambia un requisito que ya se entregó (`propose`)](#12-paso-11-cambia-un-requisito-que-ya-se-entrego-propose)
13. [Paso 12 — Automatiza la entrega con el harness (`harness run`)](#13-paso-12-automatiza-la-entrega-con-el-harness-harness-run)
14. [Paso 13 — Herramientas complementarias (VS Code · MCP · agentes)](#14-paso-13-herramientas-complementarias)
15. [Chuleta de comandos](#15-chuleta-de-comandos)

---

## 1. Requisitos previos

- **Node.js ≥ 22** y **git** en tu `PATH`.
- Acceso a la red la primera vez que ejecutas `specops add`: clona el repo
  del pack en una caché por usuario (`~/.cache/specgate/packs/…`). Después funciona
  sin conexión.

Si quieres, instala la CLI de forma global para que `specgate` funcione en todas partes:

```bash
npm install -g @rsaglobaltech/specgate@latest
specgate --version          # 1.5.0
specgate --help             # the six you start with: init; propose, apply, status, archive; check
specgate --help --all       # the whole surface
```

---

## 2. Paso 1 — Crea el proyecto (`init`)

> 📍 **Ejecútalo desde:** el directorio **padre** (p. ej. `~/sandbox`). `init`
> _crea_ `smart-parking/` por ti.

### Concepto

`init` no escribe lógica de negocio. Crea un **proyecto spec-driven
vacío pero válido**: las carpetas, el documento de requisitos y la
matriz de trazabilidad, el esqueleto que todo lo demás rellena. Es el
`git init` del desarrollo guiado por especificaciones.

Describes el proyecto en un pequeño **archivo de configuración**. Puede ser un mapa
YAML (`.yaml` / `.yml`) o el formato antiguo `KEY="value"` (`.config`);
`init` elige el parser por la extensión del archivo. Aquí usamos YAML.

### Hazlo

```bash
mkdir -p ~/sandbox && cd ~/sandbox

cat > smart-parking.yaml <<'EOF'
# Required
PROJECT_NAME: Smart Parking
PROJECT_SLUG: smart-parking
PROJECT_TYPE: backend # backend | frontend | mobile
DOMAIN: parking operations
STACK: Quarkus 3.x, Java 21, PostgreSQL, RESTEasy Reactive, Maven
API_STYLE: REST with DTO boundaries
TESTING: JUnit 5, Testcontainers, Cucumber

# Optional
LANG: en
MODULES: "" # e.g. auth,billing
EOF

specgate init --config ./smart-parking.yaml --out .
cd smart-parking          # ← from here on, you stay inside the project
```

**Flags:** `--force` (sobrescribe una carpeta existente), `--dry-run` (imprime
lo que haría, sin escribir nada), `--no-git` (omite `git init`).

### Lo que deberías ver

```text
smart-parking/
├── spec.md                  # the requirements document — prose
├── AGENTS.md              # stack guardrails for AI agents
├── README.md
├── features/                # Gherkin scenarios will live here
└── docs/specs/
    ├── traceability.md       # the requirement ↔ code matrix — the spine
    └── adr/
```

El esqueleto trae un requisito, `REQ-000 — The service reports its
own health`, así que el proyecto ya es válido; `--no-sample-req` lo omite.
`docs/specs/traceability.md` se **genera** a partir de `spec.md`, las etiquetas
de los escenarios y tus tests: nadie lo edita, y `specgate matrix` lo regenera.
Ahora le damos al proyecto un dominio real.

---

## 3. Paso 2 — Aplica el pack de dominio (`specops add`)

> 📍 **Ejecútalo desde:** dentro de tu proyecto, `smart-parking/`.

### Concepto

Un **pack de dominio** es conocimiento de dominio reutilizable y versionado: requisitos,
casos de uso, comandos, agregados, eventos y los escenarios Gherkin que los
fijan. Vive en su propio repo (aquí,
`parking-management-specops`), etiquetado con versiones como `v0.1.0`.

`specops add` es el **npm-install del desarrollo guiado por especificaciones**. Hace esto:

1. clona el repo del pack (en la versión que fijas),
2. **renderiza las plantillas del pack en tu proyecto**: esa es la flecha
   del diagrama de arriba; el conocimiento fluye _desde_ el repo del pack _hacia_
   `smart-parking/`,
3. escribe un archivo **`.specops.lock`** en tu proyecto que recuerda el
   repo, la versión, el commit y las variables, para que nunca los vuelvas a escribir.

No estás editando el pack. Estás trayendo una instantánea de él a tu
proyecto.

### Hazlo

```bash
specgate specops add \
  --pack-repo https://github.com/rsaglobaltech/parking-management-specops.git \
  --pack-version v0.1.0 \
  --pack backend \
  --var PROJECT_NAME="Smart Parking" \
  --var PROJECT_SLUG=smart-parking \
  --var DOMAIN="parking operations"
```

### Lo que deberías ver — todo esto aterriza **dentro de `smart-parking/`**

- Nuevos archivos `.feature` bajo `features/` (entrada de vehículos, umbral de
  capacidad, facturación, exceso de estancia, recibos…).
- Una fila generada por escenario en `docs/specs/traceability.md`.
- Documentación de dominio completa: `docs/specs/{use-cases,aggregates,commands,events,domain-model}.md`.
- **`.specops.lock`**: el enlace de vuelta al pack. Registra repo, versión,
  commit resuelto y tus valores de `--var`.
- **`.specops/baseline/…`**: una copia literal de exactamente lo que renderizó
  el pack. Es el «ancestro conocido» que permite que un `specops sync` posterior
  haga merge con seguridad en lugar de machacar tus ediciones.

> ✅ **Haz commit de `.specops.lock` y `.specops/` en git.** Un compañero que
> clone tu proyecto necesita ambos para que `specops sync` funcione.

**Flags útiles:** `--dry-run`, `--cache-dir <path>`, `--pack-root <path>`
(apunta a una carpeta de pack local en lugar de a una URL de git; práctico sin conexión o para
tests).

> **`expand` es la versión de bajo nivel de esto.** `specops add` es el
> envoltorio amable; `expand` hace el mismo renderizado con flags más
> explícitos y sin la contabilidad del lockfile. Usa `specops add` en el día a día.

---

## 4. Paso 3 — Ejecuta el gate (`check`)

> 📍 **Ejecútalo desde:** dentro de tu proyecto, `smart-parking/`.

### Concepto

`check` es el **gate**: el único comando que dice si el proyecto es
honesto. Ejecuta `validate --strict` —archivos obligatorios, cada `.feature`
reclamado por un requisito, escenarios etiquetados `@REQ-NNN @SCN-NNN`, estados
válidos, Gherkin que se puede parsear, y ningún requisito más allá de `Draft` sin un test
que lo nombre— y después **tu propia suite de tests**. Es lo que ejecuta CI, y
es el mismo comando que ejecutas en local.

Dile una vez cómo ejecutar tus tests. `init` no escribió ningún build —ni `pom.xml`,
ni `mvnw`—, así que crea primero tu proyecto Quarkus/Maven en `smart-parking/`
(code.quarkus.io, o el tuyo), y después define el comando de tests **de tu build**:

```bash
specgate config set test_cmd "./mvnw -B verify"   # your build's: mvn -B test, npm test, pytest…
```

```text
  ✔  test_cmd = ./mvnw -B verify
     harness.config.yaml
     `check` and `apply` now run it.
```

### Hazlo

```bash
specgate check
```

Justo después de `specops add` pasa: todos los requisitos del pack siguen en
`Draft`, y un requisito en Draft todavía no debe nada. Sin comando de tests
también pasa, y lo dice —*"this checked the specification, not the
code"*—, porque un gate que nunca ejecutó tus tests no debería decir que lo hizo.

**La regla que más importa** es `[TDD-1]`: un requisito cuyo estado ha
salido de `Draft` debe tener un test que **mencione su id**. Esa mención es
todo el enlace: no hay nada que registrar. `[TDD-2]` (una fila sin escenario)
y `[TDD-3]` (un `REQ-NNN` en `spec.md` sin fila) cubren el resto.

Pon `specgate check` en CI con `specgate ci init`.

---

## 5. Paso 4 — Mira lo que queda por construir (`status`)

> 📍 **Ejecútalo desde:** dentro de tu proyecto, `smart-parking/`.

### Concepto

Después de `specops add`, tu proyecto tiene escenarios pero no código. `status`
responde a **«¿qué hago ahora?»**: requisito a requisito, lo que aún necesita
cada uno, y el único comando siguiente que ejecutar.

### Hazlo

```bash
specgate status
```

```text
  ◆ specgate · status   smart-parking

  Requirements  ░░░░░░░░░░░░░░░░░░░░  0 of 6 done

  To do ──────────────────────────────────────────────────
    ○ REQ-000  Health baseline              its test
    ○ REQ-001  Monitor Capacity Threshold   a test and code
    ○ REQ-002  Register Vehicle Entry       a test and code
    ○ REQ-003  Calculate Parking Fee        a test and code
    ○ REQ-004  Detect Overstay              a test and code
    ○ REQ-005  Send Payment Receipt         a test and code

  Next ───────────────────────────────────────────────────
  ➜  specgate apply REQ-000
     once a test mentions REQ-000 — that mention is the link; apply checks first
```

(Salida recortada; el formato es el de la CLI.) Empieza cada día con él; nunca
tienes que recordar qué comando toca. Los requisitos de un change que sigue
abierto también aparecen: cuentan mientras el change está en curso.

> **Antes de que exista un change**, `specgate explore "<question>"` imprime un resumen del
> estado del proyecto para pensarlo con una persona o un agente; no escribe
> nada. Consulta la [referencia de comandos](commands.md#starting-a-project).

### Modo legible por máquina

```bash
specgate plan --json
```

`plan` es la vista detallada detrás de `status` para los requisitos que ya están en
la especificación: los requisitos de un change abierto los lista `status`, no
`plan`, hasta que el change se archiva. Por requisito, si existen su
feature, su test y su código, en un grupo (`NEEDS_FEATURE`,
`NEEDS_EVERYTHING`, `NEEDS_TEST`, `NEEDS_IMPLEMENTATION`,
`NEEDS_STATUS_UPDATE`, `DONE`). Su JSON es la cola de tareas que consume el harness
en el Paso 12, y lo que lee un agente para saber en qué trabajar.

---

## 6. Paso 5 — Implementa un requisito y entrégalo (`apply`)

> 📍 **Ejecútalo desde:** dentro de tu proyecto, `smart-parking/`.

### Concepto

El bucle de cada requisito son siempre los mismos cuatro movimientos:

1. **Lee** el requisito en `spec.md` y su archivo `.feature`: la
   especificación ejecutable, la fuente de verdad del comportamiento.
2. **Escribe primero el test**, y **nombra el requisito en él**:
   `REQ-001` en el nombre del test o en un comentario. Esa mención es el enlace.
3. **Escribe el código de producción** hasta que el test pase.
4. **Entrégalo** con `apply`, que primero ejecuta el gate.

### Hazlo

`apply` se niega mientras ningún test nombre el requisito:

```bash
specgate apply REQ-001
```

```text
  ◆ specgate · apply REQ-001   Implemented

  ✖  REQ-001  REQ-001 has no test that names it yet (TDD-1).  [apply_no_test]
     fix: write a test that names REQ-001 (and its scenario SCN-001), then run specgate apply REQ-001
```

Escribe el test, nombrando el requisito y su escenario:

```java
// REQ-001 SCN-001: operators are alerted at the capacity threshold
@Test void alertsAtNinetyPercentOccupancy() { … }
```

…después el código, hasta que tu suite pase, y ejecútalo otra vez:

```bash
specgate apply REQ-001
```

```text
  ✔  Specification   the gate, for REQ-001
  ✔  Tests           ./mvnw -B verify

  ✔  REQ-001 → Implemented (1 row updated)
```

`apply` ejecuta el gate —la especificación **y** tu `test_cmd`— y marca
el requisito como `Implemented` solo si pasa; cuando el gate falla no escribe
nada. Sin id, toma el siguiente requisito que nombra `status`.
`--status Verified` (o `Released`) apunta a un estado posterior; `apply REQ-001
REQ-002 …` entrega varios con una sola ejecución de la suite; `--no-check` omite el
gate, y lo dice.

---

## 7. Paso 6 — Añade un requisito NUEVO (`propose` · `archive`)

> 📍 **Ejecútalo desde:** dentro de tu proyecto, `smart-parking/`. Aquí **no**
> tocas el repo del pack.

### Concepto

El pack cubre las operaciones de un parking en general, pero **tu** proyecto necesita
algo más; por ejemplo, _«los operadores pueden reservar una plaza con antelación»_.
Lo añades **en local, en tu proyecto**. Es tuyo, no del pack.

El trabajo nuevo llega como un **change**: una carpeta bajo `docs/specs/changes/` con
sus notas de descubrimiento, un diseño, una lista de tareas y un *delta*: los requisitos que añade, con sus
escenarios. El change sigue abierto mientras lo construyes, y sus requisitos
ya cuentan: `status` los lista, `apply` los entrega. Cuando todos están en
`Implemented`, `archive` hace merge del delta en la especificación. **Un change
se archiva cuando su código está terminado**: spec y código llegan en el mismo pull
request.

### Hazlo

```bash
specgate propose add-reservations --capability reservations
```

```text
  ✔  Change add-reservations created · lite · REQ ids REQ-006…REQ-008 reserved

    + docs/specs/changes/add-reservations/change.yaml
    + docs/specs/changes/add-reservations/discover.md
    + docs/specs/changes/add-reservations/design.md
    + docs/specs/changes/add-reservations/tasks.md
    + docs/specs/changes/add-reservations/specs/reservations/spec.md

  Next ───────────────────────────────────────────────────
  ➜  specgate apply
     after you write the delta, a test that names each requirement, and the code
```

El rango reservado hace que dos changes en curso nunca repartan el mismo
`REQ-NNN`. Cualquier id dentro de él sirve; este toma `REQ-007`, porque la
siguiente versión del pack (Paso 7) añade un `REQ-006` propio. Escribe el delta en
`docs/specs/changes/add-reservations/specs/reservations/spec.md`;
`specgate change instructions specs` imprime la plantilla y las reglas:

```markdown
# Delta — reservations

## ADDED Requirements

### Requirement: REQ-007 — Reserve a spot in advance

The system SHALL let an operator reserve a free spot for a future window.

#### Scenario: Reserving an available spot

- GIVEN spot "A-12" is free between "09:00" and "11:00"
- WHEN an operator reserves spot "A-12" for that window
- THEN spot "A-12" is marked "Reserved" for that window

<!-- specgate:trace kind=functional actor=Operator -->
```

Los pasos son viñetas `- GIVEN` sin más, y el cuerpo necesita `SHALL`, `MUST`,
`SHOULD` o `MAY`. El `kind=` del comentario de traza (functional, non-functional o
business-rule) es obligatorio: sin él `change validate` informa de
`change_not_approvable` y `change approve` rechaza el change. `actor=`
nombra quién usa el requisito; `change instructions specs` también lo pide,
y las vistas de casos de uso agrupan los requisitos por él. `specgate status` lista ahora
`REQ-007` con *a test and code* pendientes. `archive` se niega mientras está pendiente:

```text
  ✖  add-reservations  Change 'add-reservations' has 1 requirement(s) not delivered yet: REQ-007.  [archive_requirements_pending]
     fix: specgate apply REQ-007
```

`apply` también espera a una persona: rechaza un requisito de un change que nadie
aprobó (`change_not_approved`). Lee el delta y después aprueba el change
tú, en tu terminal. Un agente no puede: aprobar rechaza una sesión sin
terminal (`approve_needs_person`).

```bash
specgate change approve add-reservations
```

Aprobar también escribe los escenarios en
`features/reservations/REQ-007.feature`, así que existen antes que el código. La
aprobación sella cada requisito por su hash; edita uno después y el
gate falla (`approved_requirement_changed`) hasta que lo vuelvas a aprobar.

Así que haz lo que hizo el Paso 5 —un test que nombre `REQ-007`, el código— y después entrégalo
y cierra el change:

```bash
specgate apply REQ-007
specgate archive add-reservations
```

```text
  ✔  REQ-007 → Implemented (1 row updated)

  Next ───────────────────────────────────────────────────
  ➜  specgate archive add-reservations
     every requirement of add-reservations is delivered

  ✔  Archived as 2026-10-19-add-reservations

    Specs         1 added · 0 modified · 0 removed
    Traceability  1 row(s) added · 0 updated · 0 removed
    Features      0 materialised
```

Archivar escribe el requisito en `docs/specs/capabilities/reservations/`,
su fila de la matriz, y guarda el change bajo `docs/specs/changes/archive/<date>-<id>/`;
el archivo feature ya está ahí desde la aprobación, así que `Features` dice 0. Marca
`tasks.md` según avanzas; una vez que todos los requisitos pasaron el gate, una tarea sin marcar
es un aviso, no un rechazo. `--force` nunca se salta la comprobación de requisitos.

> **¿Un requisito, sin carpeta de change?** `specgate new "<title>"` sigue escribiendo
> un `## REQ-NNN` en borrador directamente en `spec.md`, con un escenario de
> `<placeholders>` bajo `features/`: el camino rápido para un proyecto que lo guarda
> todo en `spec.md`. Reescribe los placeholders y después `apply` como arriba.
>
> **¿Un módulo entero nuevo, no un requisito?** Escríbelo en
> `docs/brief.md` y deja que `specgate propose --from-brief` lo convierta en un change
> en borrador, módulo a módulo; consulta [Escribir el brief](start/write-the-brief.md).
> Un borrador sigue el mismo camino: revisado, aplicado y después archivado.
>
> **Vigila los ids cuando actualices el pack.** `propose` reserva los siguientes
> ids libres, y una versión posterior del pack puede añadir el mismo. Si este change
> hubiera conservado `REQ-006`, el `sync` del Paso 7 se detendría: ambas versiones escriben una
> fila `REQ-006` en `docs/specs/traceability.md`, así que sync lo informa como el
> archivo en conflicto (`CONFLICT (markers written)`) y sale con un código distinto de cero. Conserva
> ambas filas y `check` falla con `Duplicate Requirement ID in
> traceability.md: REQ-006`. Lee el diff antes de sincronizar, y da antes a tu requisito
> local un id libre si el pack reclama el suyo.

---

## 8. Paso 7 — Actualiza la versión del pack (`specops diff` + `specops sync`)

> 📍 **Ejecútalo desde:** dentro de tu proyecto, `smart-parking/`.
>
> ⚠️ **Este es el paso en el que la gente se equivoca.** `diff` y `sync` se ejecutan **desde
> tu proyecto de implementación**, _no_ desde el repo del pack. El repo del pack es
> solo la fuente. `diff`/`sync` reconcilian **tu proyecto** con una versión más nueva
> del pack, usando el `.specops.lock` que vive dentro de tu proyecto.
> Para esto nunca entras con `cd` en `parking-management-specops`.

### Concepto

Pasa el tiempo. Los mantenedores del pack publican una nueva etiqueta de git —por ejemplo `v0.2.0`—
con escenarios nuevos y correcciones. Tú decides _cuándo_ adoptarla. Dos comandos:

- **`specops diff`**: _previsualiza_. Renderiza el pack en la nueva versión en una
  carpeta temporal desechable y te muestra qué cambiaría. No escribe nada.
- **`specops sync`**: _aplica_. Vuelve a renderizar el pack y hace un **merge a tres bandas**
  del resultado en tu proyecto, conservando tus ediciones locales.

### 8.1 Previsualiza el cambio — `specops diff`

```bash
# still inside smart-parking/
specgate specops diff --pack-version v0.2.0 \
  --var STACK="Quarkus 3.x, Java 21" --var API_STYLE="REST with DTO boundaries" \
  --var TESTING="JUnit 5, Cucumber" --var LANG=en
```

```text
── backend @ v0.2.0 (current: v0.1.0) ──
  + features/waitlist/capacity_waitlist.feature
  ~ AI_RULES.md
  ~ docs/specs/commands.md
  ~ docs/specs/domain-model.md
  ~ docs/specs/events.md
  ~ docs/specs/traceability.md
  ~ docs/specs/use-cases.md

  1 added · 6 modified · 7 unchanged
```

`+` es un archivo nuevo, `~` uno modificado. No se escribe nada. `--json` emite
los mismos datos para herramientas.

**¿Por qué los `--var`?** La `v0.2.0` de este pack exige cuatro variables que la `v0.1.0`
no pedía. Sin ellas `diff` y `sync` se detienen con
`Missing required variable 'STACK'. Provide it using --var STACK=...`. Pásalas
una vez; `sync` las vuelve a escribir en `.specops.lock`.

### 8.2 Aplícalo — `specops sync`

```bash
specgate specops sync --pack-version v0.2.0 \
  --var STACK="Quarkus 3.x, Java 21" --var API_STYLE="REST with DTO boundaries" \
  --var TESTING="JUnit 5, Cucumber" --var LANG=en
```

`sync` vuelve a renderizar el pack y, para cada archivo, compara **tres versiones**:

- **base**: lo que renderizó el pack la última vez (guardado en `.specops/baseline/`),
- **local**: lo que hay ahora en tu proyecto (puede que lo hayas editado a mano),
- **incoming**: lo que renderiza el pack en la nueva versión.

A partir de eso elige un resultado por archivo:

| Resultado   | Significado                                                             |
| ----------- | ----------------------------------------------------------------------- |
| `added`     | archivo nuevo del pack: se escribe                                      |
| `unchanged` | ya es idéntico: nada que hacer                                          |
| `updated`   | nunca lo tocaste → se toma la nueva versión del pack                    |
| `kept`      | el pack **no** lo cambió pero tú sí → **tu edición se conserva**        |
| `merged`    | ambos cambiaron, líneas distintas → merge limpio                        |
| `CONFLICT`  | ambos cambiaron las **mismas** líneas → se escriben marcadores `<<<<<<<` estilo git |

`sync` **sale con un código distinto de cero** si algún archivo queda en `CONFLICT`, para que CI lo note.
Resuelve los marcadores a mano y vuelve a ejecutarlo.

**Flags:** `--dry-run` (previsualiza, no escribe nada), `--force` (el pack siempre
gana: descarta las ediciones locales), `--abort-on-conflict` (deja intactos los archivos
en conflicto en lugar de escribir marcadores), `--pack <id>` (sincroniza solo un pack).

### 8.3 Después de un sync

```bash
specgate status                      # new REQs from the pack now show as pending
specgate check
git add .specops.lock .specops/ docs/ features/
git commit -m "chore: sync parking pack to v0.2.0"
```

> **Lee `status` después de un sync.** Un requisito que habías cerrado puede volver
> como *Ready to close* cuando el sync reescribió sus archivos: ejecuta `specgate apply`
> para él otra vez; su test sigue ahí, así que el gate pasa.

> Ejecutar `specgate specops sync` **sin** `--pack-version` simplemente vuelve a renderizar
> todo en las versiones ya fijadas en `.specops.lock`: práctico
> tras un clon nuevo, o para regenerar un archivo que alguien borró.

---

## 9. Paso 8 — Quita un pack (`specops remove`)

> 📍 **Ejecútalo desde:** dentro de tu proyecto, `smart-parking/`.

```bash
specgate specops remove backend
```

`remove` elimina la entrada del pack de `.specops.lock`. A propósito **no**
borra los archivos generados: puede que hayas editado a mano tests que
apuntan a ellos. Revisa con `git status` y borra a mano lo que ya no
quieras. `--dry-run` muestra lo que se eliminaría.

---

## 10. Paso 9 — Crea tu propio pack

> 📦 **Ejecútalo desde:** el **repo del pack**, una carpeta para _tu_ pack (p. ej.
> `~/sandbox/domain-packs/…`), **no** tu proyecto de implementación. Este es
> el único sitio del tutorial en el que sales de `smart-parking/`.

### Concepto

Hasta ahora has _consumido_ un pack. Tarde o temprano querrás empaquetar
**tu propio** conocimiento de dominio para que otros proyectos (o tu yo futuro) puedan
hacerle `specops add`. Cuatro comandos cubren el ciclo de autoría.

### 10.1 Esqueleto — `pack init`

```bash
cd ~/sandbox
specgate pack init --out ./domain-packs --name "Reservations Backend" --type backend
# flavours: backend · frontend · mobile · contracts
```

Escribe `./domain-packs/reservations-backend/backend/pack.yaml` más una
carpeta `templates/`: el id del pack es el slug de `--name`, después `--type`:
`reservations-backend/backend`, el id que usan todos los `--pack` de abajo.

### 10.2 Lint — `pack lint`

`pack lint` valida un pack más allá de su JSON Schema: IDs únicos,
integridad de las referencias cruzadas y **calidad de los escenarios**.

```bash
specgate pack lint --pack-root ./domain-packs --pack reservations-backend/backend
```

Las reglas de calidad de escenarios señalan Gherkin vago o escaso: un `Scenario
Outline` sin `Examples`, un escenario al que le falta un `When`/`Then`, menos de
tres pasos, un título genérico, un lenguaje de paso vago (`works`, `correctly`,
`as expected`, `etc`, `TODO`, `...`), o un nombre de escenario en `pack.yaml` que
se ha alejado del título de su plantilla.

```bash
# In CI — and before a pack feeds the harness — promote those to errors:
specgate pack lint --pack-root ./domain-packs --pack reservations-backend/backend --strict
```

Esto importa porque los escenarios del pack se convierten en la **señal de recompensa** del
harness (Paso 12): escenarios débiles dejan que el harness dé por bueno código
débil.

### 10.3 Mira el grafo de referencias — `pack lint --graph`

Lo más difícil de crear un pack es mantener coherentes a mano las
referencias cruzadas `REQ → UC → CMD/QUERY/AGG → EVT`.
`--graph` dibuja esa columna vertebral para que puedas _verla_:

```bash
# Mermaid (default) — renders natively in GitHub and VS Code
specgate pack lint --pack-root ./domain-packs --pack reservations-backend/backend --graph

# Graphviz DOT
specgate pack lint --pack-root ./domain-packs --pack reservations-backend/backend --graph --graph-format dot
```

Una referencia a un ID o nombre que no existe se convierte en un nodo rojo **missing**
en el diagrama **y** se lista en stderr; además el comando sale con un código
distinto de cero, así que `--graph` sirve también como comprobación de enlaces en CI.

### 10.4 Invierte el flujo — `pack infer`

Escribir primero el modelo (requisitos → casos de uso → comandos → eventos) y
los escenarios al final huele a cascada. `pack infer` le da la vuelta: escribe primero el
`.feature` y recibe a cambio un esqueleto de `pack.yaml` propuesto.

```bash
# still in ~/sandbox — a draft scenario, outside the pack
mkdir -p drafts
cat > drafts/reserve_spot.feature <<'EOF'
@REQ-001
Feature: Reserve a spot in advance

  Scenario: Reserving an available spot
    Given spot "A-12" is free between "09:00" and "11:00"
    When an operator reserves spot "A-12" for that window
    Then spot "A-12" is marked "Reserved" for that window
    And a "SpotReserved" event is emitted
EOF

specgate pack infer --from ./drafts/reserve_spot.feature
```

Asigna de forma heurística una etiqueta `@REQ-NNN` → una referencia a requisito; el
nombre de `Feature:` → el nombre del caso de uso; cada paso `When` → un comando **o una
query**; un token PascalCase entre comillas en un paso `Then` → un evento; cada
`Scenario:` → una entrada de `scenarios[]`. Lo que no puede inferir lo deja como un
`TODO:` explícito: un esqueleto que revisar, nunca una suposición silenciosa. La salida va a
stdout (`--format json` para herramientas); nunca modifica `pack.yaml`.

Cinco cosas que hace y que conviene saber, porque cada una antes era una
corrección que hacías a mano:

- **La misma operación se propone una vez.** Un camino feliz y su fallo
  ejercitan un comando; antes llegaban como dos entradas con dos ids.
- **Un `When` que lee se convierte en una query**, con un id `QRY-`: «searches»,
  «views», «lists». El modelo del pack ya separa las queries de los comandos;
  ahora la inferencia también.
- **Los nombres pierden el relleno.** «10 more vehicles enter the facility» da
  `MoreVehiclesEnterFacility`, no `MoreVehiclesEnterThe`.
- **Los nombres de campo se proponen a partir del Gherkin** —`<placeholders>` en un
  Scenario Outline y pares `key: value`—, cada uno con un `TODO` para su tipo.
  Los nombres están en el archivo; los tipos no, y un tipo adivinado que pareciera
  seguro es justo lo que rechaza [ADR-0014](specs/adr/0014-pack-infer-heuristic.md).
- **`--from` se repite, y acepta un directorio.** Una capacidad rara vez es un archivo,
  e inferir archivo a archivo propone un comando compartido una vez por archivo:

  ```bash
  specgate pack infer --from ./drafts/            # every .feature in it
  specgate pack infer --from a.feature --from b.feature
  ```

```bash
# Keep the proposal in a file of its own to review:
specgate pack infer --from ./drafts/reserve_spot.feature > drafts/reserve_spot.inferred.yaml
```

No la añadas al final de `pack.yaml`: el fragmento tiene sus propias claves `requirements:`,
`use_cases:`, `events:` y `scenarios:`, y `pack.yaml` ya
las tiene, así que `>>` deja cada clave dos veces. Copia cada entrada que conserves en la lista
del mismo nombre en `pack.yaml`, resuelve sus `TODO` y `UC-XXX`, y después ejecuta
`pack lint` (10.2).

---

## 11. Paso 10 — Añade un requisito NUEVO (como autor de un pack)

> 📦 **Ejecútalo desde:** el **repo del pack** (p. ej. un clon de
> `parking-management-specops`, o la carpeta de tu propio pack). Esta es la
> _otra mitad_ de «añadir un requisito»: el Paso 6 añadió uno a un solo
> proyecto; esto añade uno al **pack**, así que **todos** los proyectos que
> hagan `specops sync` lo recibirán.

### 11.1 Redacta el escenario y después infiere el modelo

```bash
# inside the pack repo
mkdir -p drafts
cat > drafts/waitlist.feature <<'EOF'
@REQ-006
Feature: Capacity waitlist

  Scenario: Joining the waitlist when the facility is full
    Given the facility is at full capacity
    When a driver requests entry
    Then the driver is added to the waitlist
    And a "DriverWaitlisted" event is emitted
EOF

specgate pack infer --from drafts/waitlist.feature
```

### 11.2 Fusiona el esqueleto inferido en `pack.yaml`

Añade las nuevas entradas `requirement`, `use_case`, `command`, `event` y `scenario`
a `pack.yaml`, sustituyendo cada `TODO:` por valores reales y ajustando
los IDs para que encajen en la numeración del pack. Añade la plantilla de feature bajo
`templates/features/…` y apunta a ella los campos `template:` / `target:`
del escenario.

### 11.3 Lint, incluido el grafo

```bash
specgate pack lint --pack-root . --pack backend --strict
specgate pack lint --pack-root . --pack backend --graph
```

`--strict` detecta un escenario nuevo débil; `--graph` muestra la nueva
columna vertebral `REQ-006 → UC-006 → … → DriverWaitlisted` y protesta si escribiste mal
una referencia.

### 11.4 Versiona, etiqueta, publica

```bash
# bump metadata.version in pack.yaml — this pack's went 1.1.0 → 1.2.0; the tag is separate:
git commit -am "feat: add capacity waitlist (REQ-006)"
git tag v0.2.0
git push --tags
```

### 11.5 Los consumidores lo adoptan, de vuelta en sus proyectos

Ahora cualquiera con un proyecto que use este pack recibe `REQ-006` mediante
el flujo normal del Paso 7, **desde dentro de su propio proyecto de implementación**:

```bash
# 📍 inside smart-parking/  (NOT the pack repo)
specgate specops diff --pack-version v0.2.0 --var …   # preview: + waitlist feature, ~ matrix
specgate specops sync --pack-version v0.2.0 --var …   # three-way merge into the project
specgate status                                       # REQ-006 now shows as pending
```

Ese es el bucle completo del autor de un pack: **redactar escenario → `pack infer` → fusionar
→ `pack lint --strict --graph` → versión + etiqueta → los consumidores hacen `diff` +
`sync`.**

---

## 12. Paso 11 — Cambia un requisito que ya se entregó (`propose`)

> 📍 **Ejecútalo desde:** dentro de tu proyecto, `smart-parking/`.

### Concepto

El Paso 6 añadió un requisito. Este es el otro caso, el que te encontrarás el
resto de la vida del proyecto: **un requisito se entregó y ahora tiene que
cambiar.** Es el mismo bucle —`propose`, `change approve`, `apply`,
`archive`— con un delta
que dice solo lo que se mueve, para que la revisión lea la modificación como intención.

Esto funciona sobre los requisitos bajo `docs/specs/capabilities/`, los que
crean los changes y los [borradores](start/write-the-brief.md). Un requisito escrito
con `specgate new` vive solo en `spec.md`: cámbialo editando su
sección y su escenario, y `check` y `apply` lo someten al mismo gate.

### Hazlo

Meses después, las reservas necesitan un depósito. Abre un segundo change y escribe solo
lo que se mueve:

```bash
specgate propose reservations-need-a-deposit --capability reservations
```

```markdown
# Delta — reservations

## MODIFIED Requirements

### Requirement: REQ-007 — Reserve a spot in advance

The system SHALL require a deposit before confirming a reservation, and SHALL
release the spot if the deposit is not paid within 15 minutes.

#### Scenario: A reservation without a deposit expires

- GIVEN spot "A-12" is reserved but unpaid
- WHEN 15 minutes pass
- THEN the reservation is cancelled and the spot is free again

<!-- specgate:trace kind=functional -->
```

`MODIFIED` sustituye el bloque entero del requisito; no hace merge escenario
a escenario. Mientras el change está abierto, `REQ-007` se juzga como será después
de archivar: `status` lo vuelve a listar y `archive` se niega hasta que se aplique.
Una persona aprueba el change de nuevo, en un terminal; después amplía su test para
cubrir el depósito, cambia el código y entrégalo:

```bash
specgate change approve reservations-need-a-deposit   # you, not the agent
specgate apply REQ-007
specgate archive reservations-need-a-deposit --dry-run   # the plan, nothing written
specgate archive reservations-need-a-deposit
```

```text
  ✔  Archived as 2026-10-19-reservations-need-a-deposit

    Specs         0 added · 1 modified · 0 removed
    Traceability  0 row(s) added · 1 updated · 0 removed
    Features      1 materialised

  ▲  features/reservations/REQ-007.feature  features/reservations/REQ-007.feature rewritten from REQ-007's modified scenarios.  [archive_feature_regenerated]
     fix: Review the diff: the feature file now matches the delta.
```

Archivar aplica el delta a `docs/specs/capabilities/`, reescribe el
escenario bajo `features/`, actualiza la fila de la matriz y guarda el change. Si un
test desmiente la redacción del delta mientras construyes, corrige el delta en el mismo
change: todavía no se ha hecho merge de nada.

> **Se combina con los packs.** Cuando cambia el propio pack,
> `specgate specops diff --pack-version v0.2.0 --as-change --var …` escribe una
> carpeta de change, `docs/specs/changes/upgrade-backend-v0.2.0/`, con el formato
> antiguo: `proposal.md`, `tasks.md` y un delta con un requisito
> `ADDED`/`MODIFIED`/`REMOVED` por cada requisito que mueve la versión
> (aquí, `REQ-006` añadido), sin `discover.md` ni `design.md`. No escribe ningún
> archivo generado: eso lo sigue haciendo `sync`. Tal como se escribe, falla `check`: el
> cuerpo del REQ-006 del pack no tiene `SHALL`, un error con el preset estándar
> (`no_rfc2119_keyword`). Para que pase, da a cada cuerpo un `SHALL` y a su
> traza un `kind=` (la aprobación rechaza uno sin él), y después apruébalo:
>
> ```bash
> # en specs/backend/spec.md: "The system SHALL let drivers join a waitlist …"
> #                           <!-- specgate:trace kind=functional uc=UC-006 … -->
> specgate check                                          # pasa
> specgate change approve upgrade-backend-v0.2.0          # tú, en un terminal
> ```
>
> `change validate` sigue avisando con `layer_no_design` hasta que tenga un `design.md`
> (`specgate migrate 1.0` añade uno a partir de la propuesta). Revisas una actualización
> de upstream como intención y no como un diff de archivos.

→ [Cambiar un requisito entregado](reviewing-changes.md) para la referencia completa.

---

## 13. Paso 12 — Automatiza la entrega con el harness (`harness run`)

> 📍 **Ejecútalo desde:** dentro de tu proyecto, `smart-parking/`.

### Concepto

Todo lo de los pasos 4–6 —leer el escenario, escribir el test, escribir el
código, ejecutar `apply`— es un bucle que puede conducir una máquina. `harness run` es ese
conductor. Para cada requisito pendiente, en un **`git worktree` aislado** sobre una
rama nueva `harness/REQ-NNN`, hace esto:

1. construye un prompt autocontenido (el escenario Gherkin + `AGENTS.md` +
   las rutas exactas de los artefactos + cualquier fallo anterior),
2. llama desde la shell a **tu** agente de IA,
3. pasa el resultado por el gate con `validate --strict` + tu comando de tests,
4. en verde → lo marca como Implemented y hace commit; en rojo → reintenta, pasando el
   fallo al siguiente prompt,
5. imprime un informe de aprobados/fallidos/intentos.

Es **neutral respecto al proveedor**: el agente es _cualquier comando de shell_ que contenga
el placeholder `{prompt_file}`. El harness nunca hace merge de una rama —tú
revisas y fusionas `harness/*`— salvo que pidas `--chain`, que
fusiona cada requisito en verde antes de crear el siguiente
([El harness](harness.md#a-chain-of-requirements-merged-as-they-pass)).

### 13.1 Configúralo — con **opencode** como agente y un prefijo de prompt para todo el proyecto

Empieza generando los dos archivos en lugar de copiarlos de esta página:

```bash
specgate harness init
```

Escribe `harness.config.yaml` y `.harness/prompt-prefix.md`, detecta tu
gate a partir de los archivos de build que encuentra (`mvn -B test` aquí, por `pom.xml`) y
deja `agent:` sin definir a propósito: qué agente ejecuta esto es decisión tuya y
son tus credenciales. Lee el prefijo que genera y haz que suene a tu
equipo; el resto de esta sección muestra cómo queda una versión rellenada.

Si manejas tu editor con [opencode](https://opencode.ai), apunta el
harness a él. El harness escribe cada prompt en un archivo temporal y sustituye
`{prompt_file}` por su ruta; `opencode run` recibe un prompt como texto, así que lee
el archivo dentro:

```yaml
# harness.config.yaml — at the root of smart-parking/
harness_version: 1
agent: 'opencode run "$(cat {prompt_file})"'
test_cmd: "mvn -q test"
max_attempts: 3

# Project-wide directives prepended to every per-REQ prompt: Role,
# Active Project Boundary, Execution Policy. Use prompt_prefix for a
# one-liner; prompt_prefix_file for the realistic multi-line case.
prompt_prefix_file: ./.harness/prompt-prefix.md
```

```markdown
<!-- .harness/prompt-prefix.md -->

# Role

You are the Lead Technical Architect and Senior Backend Engineer.

# Active Project Boundary

- Current directory is the only scope. Do NOT scan siblings.

# Execution Policy

- Start coding. No planning-only output.
- Hexagonal architecture is non-negotiable (see AGENTS.md).
- Never modify AGENTS.md, spec.md, or features/**/*.feature.
```

Con un archivo de configuración no tienes que volver a escribir nada. (Cualquier otro agente
funciona igual; p. ej. `claude -p < {prompt_file}` o
`aider --yes --message-file {prompt_file}`.) El `prompt_prefix` /
`prompt_prefix_file` acompaña a **cada** prompt por REQ, así que tus
directivas universales ni se duplican ni se olvidan.

### 13.2 Primero, un dry-run

```bash
specgate harness run --dry-run
```

`--dry-run` construye e imprime el prompt de cada requisito pendiente
**sin** invocar al agente ni tocar git. Lee lo que recibiría opencode
antes de gastar tokens.

### 13.3 Ejecútalo

```bash
# the working tree must be clean — the harness refuses a dirty tree
specgate harness run --agent 'opencode run "$(cat {prompt_file})"' --test-cmd "mvn -q test"
```

(Si pones el agente y el comando de tests en `harness.config.yaml`, basta con
`specgate harness run` a secas.)

```text
── harness report ──
  ✅ REQ-002  pass (1 attempt)   → harness/REQ-002
  ✅ REQ-003  pass (2 attempts)  → harness/REQ-003
  ❌ REQ-004  fail (3 attempts)  → harness/REQ-004
       Gate failed at: test command

  2 passed · 1 failed · 0 skipped
  Review and merge the harness/* branches you trust.
```

**Flags:** `--req REQ-NNN` (limita a requisitos concretos, repetible;
ideal para probar uno primero), `--max-attempts <n>`, `--base-branch <ref>`,
`--timeout <seconds>`, `--keep-worktrees`, `--force` (vuelve a crear las ramas
`harness/*` existentes), `--setup-cmd <cmd|none>` (la instalación que ejecuta cada worktree
nuevo), `--format json`. Para ver una ejecución mientras ocurre, `specgate studio` la muestra
en su sección Live (`/live`); consulta [El studio](studio.md#live).

El comando sale con un código distinto de cero si algún requisito no pasó, así que CI puede usarlo
como gate. Cada resultado es una rama que puedes sacar, inspeccionar y fusionar, o
tirar.

### 13.4 Inspecciona lo que recibirá el agente (`harness prompt`)

```bash
specgate harness prompt REQ-004   # still pending: the run above left it failing (REQ-001 shipped in Step 5)
```

Imprime el prompt exacto que el harness _daría_ al agente para un REQ
—prefijo incluido— sin invocar al agente, crear worktrees ni
tocar git. Úsalo para:

- iterar sobre `AGENTS.md` y `prompt_prefix` y ver el efecto de inmediato;
- copiar y pegar el prompt en una IA web cuando no hay ningún agente de CLI disponible;
- revisar lo que dicen ahora las directivas permanentes del equipo.

Cada prompt que el harness envía de verdad durante `harness run` también se
copia en `.specops/harness-prompts/REQ-NNN-<timestamp>-attempt-N.md`
para revisarlo después. Haz commit de esa carpeta o añádela a .gitignore según
prefiera tu equipo.

---

## 13½. Multi-stack: un pack, muchas implementaciones

La separación entre pack e implementación te permite entregar la **misma especificación de dominio** en
varios stacks sin duplicar requisitos ni escenarios. Cada
implementación es su propio repo:

```text
parking-management-specops@v0.1.0      ◄── one spec, stack-agnostic
        ├──► smart-parking-spring/      (STACK=Spring Boot, JUnit+Cucumber)
        ├──► smart-parking-quarkus/     (STACK=Quarkus,     JUnit+Cucumber)
        └──► smart-parking-micronaut/   (STACK=Micronaut,   JUnit+Cucumber)
```

Cada proyecto ejecuta su propio `specgate init` con un `STACK` distinto en la
configuración, su propio `specgate specops add` contra el **mismo** repo de pack +
versión + `--var` de dominio, y su propio bucle de harness. `spec.md` y
`features/**` son **idénticos** en todos los stacks (renderizados desde el mismo pack).
`AGENTS.md` difiere porque difiere su sustitución de `{{STACK}}`, y también
cada matriz de trazabilidad: asigna un requisito al archivo que lo implementa
y al archivo que lo demuestra, y esos archivos difieren por stack. En un solo
repositorio, `specgate init --multi-stack spring,quarkus,micronaut` monta la
misma disposición bajo una raíz.

Útil para pruebas de concepto de migración, comparativas de frameworks, material educativo
(«el mismo problema, tres stacks»). La arquitectura lo soporta de forma explícita;
consulta [`docs/specs/architecture.md`](./specs/architecture.md) §5.

---

## 14. Paso 13 — Herramientas complementarias

### Extensión de VS Code

La extensión `vscode-spec-driven` convierte el editor en una superficie para crear
packs: subrayados en vivo del JSON Schema en `pack.yaml`, **diagnóstico de referencias
colgantes**, **autocompletado de campos de referencia** (ofrece los IDs/nombres que
de verdad existen), **ir a la definición** en una referencia, un **CodeLens** que muestra
cuántos casos de uso y escenarios apuntan a cada requisito,
validación al guardar, y el comando **`Spec-Driven: Show Pack Graph`**: un
render Mermaid del grafo del pack en un panel lateral que se refresca mientras editas.

### Servidor MCP

```bash
specgate mcp install --client claude   # or cursor — writes the client's MCP config
specgate mcp serve                     # what that config starts, over stdio
```

El servidor expone la CLI como herramientas MCP —`specgate_status`, `specgate_check`,
`specgate_done`, `specgate_change_new`, `specgate_change_archive` y el resto
(los cuatro verbos con sus nombres antiguos)—, así que un cliente compatible con MCP
puede conducir el mismo bucle de forma nativa. Consulta [Servidor MCP](mcp.md).

### Slash commands, para once herramientas de agente a la vez

```bash
specgate agents init                     # or --tool claude,cursor
```

Eso escribe `/specgate:explore`, `/specgate:draft`, `/specgate:new`, `/specgate:apply`, `/specgate:check`,
`/specgate:done`, `/specgate:propose`, `/specgate:archive` y `/specgate:onboard`, más el archivo de instrucciones que lee cada herramienta
—`.cursor/rules/`, `.github/copilot-instructions.md`, `CONVENTIONS.md`, etc.
Son escuetos a propósito: en lugar de repetir la gramática del delta, que
quedaría obsoleta en cuanto cambiara, llaman a `specgate change instructions
<artifact> --json` para obtenerla.

Tras actualizar la CLI, `specgate update` hace un merge a tres bandas de esos archivos para que tus ediciones
sobrevivan.

### Mantener honesto un repositorio existente

Este tutorial empezó con `init`, en una página en blanco. En un repositorio que
ya tiene código, `specgate init` lo adopta: lee la estructura, propone las
capacidades que el código ya implica y escribe el esqueleto de la spec sin
tocar una línea del código fuente. `specgate onboard --tour` ejecuta el bucle entero
—propose, un test, `status`, `apply`, `archive`, `check`— sobre una copia temporal de
él y narra cada paso ([referencia de comandos](commands.md#starting-a-project)).
`specgate doctor` informa de lo que se ha desviado, con una corrección por hallazgo.

---

## 15. Chuleta de comandos

La columna 📍 / 📦 es lo que hay que recordar: **dónde** lo ejecutas.

| Comando | Se ejecuta desde | Qué hace |
| --- | --- | --- |
| `specgate init [--config <f.yaml> --out <dir>]` | 📍 dir. padre | Crea un proyecto nuevo, o adopta un repositorio que ya tiene código |
| `specgate propose <id> [--capability <c>]` | 📍 proyecto | Abre un change: propuesta, tareas, un delta por escribir, ids reservados |
| `specgate propose --from-brief [<module>]` | 📍 proyecto | De un plan en `docs/brief.md` a un change en borrador, un módulo cada vez |
| `specgate propose --from-ticket <KEY>` | 📍 proyecto | De una historia de Jira a un change en su propia rama, comprobado contra el ticket |
| `specgate apply [<REQ-NNN …>] [--status <S>]` | 📍 proyecto | Rechaza si ningún test lo nombra; si no, ejecuta el gate y lo marca como Implemented |
| `specgate status` | 📍 proyecto | Lo que aún necesita cada requisito —changes abiertos incluidos— y el siguiente comando que ejecutar |
| `specgate archive <id> [--dry-run]` | 📍 proyecto | Hace merge de un change cuyos requisitos están todos en Implemented |
| `specgate check` | 📍 proyecto | El gate, en local y en CI: `validate --strict` y después tu `test_cmd` |
| `specgate new "<title>"` | 📍 proyecto | Un requisito directamente en `spec.md`: su sección, su escenario etiquetado, su fila |
| `specgate explore ["<question>"]` | 📍 proyecto | Un resumen de cómo está el proyecto, para pensar antes de que exista un change |
| `specgate config set test_cmd "<cmd>"` | 📍 proyecto | Dice a `check` y `apply` cómo ejecutar tus tests |
| `specgate matrix [--check]` | 📍 proyecto | Regenera la matriz de trazabilidad a partir de la spec, las etiquetas y los tests |
| `specgate plan [--json]` | 📍 proyecto | El detalle por requisito de los requisitos de la especificación; los de un change abierto están en `status` |
| `specgate fix [--dry-run]` | 📍 proyecto | Aplica las reparaciones que sugiere `validate` |
| `specgate change status \| validate \| show \| list` | 📍 proyecto | Qué escribir ahora · comprobar los deltas · inspeccionar · enumerar |
| `specgate change approve <id>` | 📍 proyecto, una persona en un terminal | Aprueba un change antes de que `apply` entregue sus requisitos; un agente no puede |
| `specgate specops add --pack-repo … --pack-version … --pack … --var …` | 📍 proyecto | Trae un pack; escribe `.specops.lock` y la baseline de `.specops/` |
| `specgate specops diff [--pack-version …] [--var …]` | 📍 proyecto | Previsualiza lo que cambiaría un sync; no escribe nada |
| `specgate specops sync [--pack-version …] [--var …]` | 📍 proyecto | Vuelve a renderizar el pack y hace un merge a tres bandas en el proyecto |
| `specgate specops remove <pack-id>` | 📍 proyecto | Quita un pack de `.specops.lock` (los archivos se quedan) |
| `specgate specops diff --as-change` | 📍 proyecto | Convierte una subida de versión del pack en un change revisable |
| `specgate specops contribute --change <id>` | 📍 proyecto | Envía un change local de vuelta al pack de upstream (nunca hace push) |
| `specgate validate --against-lock` | 📍 proyecto | Hace fallar CI cuando el proyecto se alejó de la versión del pack fijada |
| `specgate harness run [--agent "… {prompt_file}"] [--req …]` | 📍 proyecto | El agente construye cada requisito pendiente en su propia rama; decide el gate |
| `specgate studio` | 📍 proyecto | Vista local de solo lectura del árbol de specs; `/live` muestra el harness trabajando |
| `specgate agents init [--tool …]` | 📍 proyecto | Slash commands y archivos de instrucciones para tus herramientas de agente |
| `specgate mcp serve` | 📍 proyecto | El servidor MCP por stdio |
| `specgate pack init --out … --name … --type backend\|frontend\|contracts\|mobile` | 📦 repo del pack | Crea el esqueleto de un pack |
| `specgate pack lint --pack-root … --pack … [--strict]` | 📦 repo del pack | Pasa lint a un pack: esquema, referencias cruzadas, calidad de escenarios |
| `specgate pack lint … --graph [--graph-format mermaid\|dot]` | 📦 repo del pack | Renderiza el grafo de referencias del pack; comprobación de enlaces en CI |
| `specgate pack infer --from <feature> [--format json]` | 📦 repo del pack | Propone un esqueleto de `pack.yaml` a partir de un `.feature` |

**Tres formas de añadir un requisito, lado a lado:**

| | Como change (pasos 6 y 11) | Rápido, en `spec.md` | Como autor de un pack (Paso 10) |
| --- | --- | --- | --- |
| Dónde | 📍 tu proyecto de implementación | 📍 tu proyecto de implementación | 📦 el repo del pack |
| 1 | `propose <id> --capability <c>` | `specgate new "<title>"` | redacta un `.feature`, ejecuta `pack infer` |
| 2 | escribe el delta bajo `specs/<cap>/spec.md`; después una persona ejecuta `change approve <id>` | reescribe su sección y su escenario | fusiona el esqueleto inferido en `pack.yaml` |
| 3 | un test que nombre el REQ, el código | un test que nombre el REQ, el código | añade la plantilla de feature bajo `templates/` |
| 4 | `apply` y después `archive` | `apply` | `pack lint --strict --graph` |
| 5 | revisable como intención, archivado con fecha | — | sube la versión, etiqueta; los consumidores hacen `specops diff` + `sync` |

En ninguna de ellas editas la matriz: se genera. La primera columna es
el bucle diario: deja un rastro de auditoría de *por qué* se añadió o
cambió un requisito, y `check` ejecuta el mismo gate en CI para las tres.

---

Ya has ejercitado los comandos que un proyecto usa en el día a día. Para una referencia más profunda,
consulta [`docs/how-to.md`](./how-to.md), la
[especificación del formato de pack de dominio](./specs/domain-pack-format.md), el
[flujo de trabajo SpecOps](./specs/specops.md) y la
[especificación del harness](./specs/harness.md).
