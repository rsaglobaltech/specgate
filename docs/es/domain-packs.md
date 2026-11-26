<!-- translation-of: 65c619e3bb8b -->
<!-- specgate:allow-placeholders — this guide quotes the {{VAR}} template syntax. -->

# Domain packs

Conocimiento de dominio reutilizable y versionado. Un pack es para un árbol de specs lo que una dependencia es para el código: lo instalas, lo fijas y lo
actualizas a propósito.

<!-- specgate:diagram three-repos -->

## Dos tipos de pack en este repositorio

Los **packs probados** vienen de productos construidos con Specgate a partir
del brief de un cliente: cada requisito lo implementó y lo probó ese producto,
y los valores de los escenarios son los que afirmaron sus tests. Lo que un
piloto no pudo responder se publica como *Needs Clarification*: la pregunta, no una respuesta inventada.

| Pack | Del piloto | Probado en | Reqs | Escenarios | Queda abierto |
|---|---|---|---|---|---|
| `ledger/backend` | Banca central (FinCore) | Spring Boot 3.3, Java 21, PostgreSQL | 10 | 14 | — |
| `transfers/backend` | Banca central (FinCore) | Spring Boot 3.3, Java 21, PostgreSQL | 11 | 14 | — |
| `event-registration/backend` | Operaciones de eventos (EventTech) | Quarkus 3, event sourcing, PostgreSQL | 8 | 11 | — |
| `clinical-record/backend` | Casos clínicos (HealthTech) | Quarkus 3, PostgreSQL, datos ficticios | 9 | 11 | alertas de interacción entre fármacos |
| `appointment-booking/backend` | [Reservas](projects/bookings.md) | TypeScript, Next.js, PostgreSQL | 10 | 14 | — |
| `shop-orders/backend` | [Tienda a crédito](projects/credit-shop.md) | TypeScript, Next.js, PostgreSQL | 9 | 10 | gastos de envío |
| `time-attendance/backend` | [Rebar Crew](projects/rebar-crew.md) | TypeScript, Expo + Next.js | 8 | 11 | — |

El código de los pilotos es privado; los packs llevan sus requisitos y
escenarios, en inglés y sin datos de clientes, en rangos de ids separados
(`REQ-101…REQ-708`) para que un proyecto pueda instalar los siete. Instálalos
con `specops add` en un proyecto hecho con `specgate init`: `init --from-pack`
falla actualmente con un requisito que tiene dos escenarios (un problema conocido).

Los **packs de partida** —`auth`, `billing`, `audit-log`, `notifications`,
`feature-flags`, `multi-tenant`, `file-storage`, `search`, `reporting`,
`webhooks`, `sample-contracts`— son ejemplos del formato: unos pocos requisitos
genéricos en Draft cada uno, y ningún producto se construyó a partir de ellos.
`metadata.tier` dice qué es un pack (`proven` o `starter`; si falta, starter), y
`pack lint` rechaza `proven` sin un `metadata.provenance` que diga qué lo probó.

---

## Escribe un domain pack desde cero

**Objetivo:** empaquetar un conjunto reutilizable de requisitos, casos de uso, agregados, eventos y plantillas Gherkin.

```bash
# 1. Scaffold a pack
npx @rsaglobaltech/specgate@latest pack init \
  --out ./domain-packs \
  --name "Billing Backend" \
  --type backend

# 2. Edit ./domain-packs/billing/backend/pack.yaml
#    Required fields (see schemas/pack.schema.json for the full schema):
#      schema_version, metadata.{name,version,language,project_type}
#      variables.required
#    Optional: requirements, use_cases, commands, aggregates, events,
#              scenarios, outputs.files, rules

# 3. Lint
npx @rsaglobaltech/specgate@latest pack lint \
  --pack-root ./domain-packs \
  --pack billing/backend
```

`pack.yaml` mínimo viable:

```yaml
# yaml-language-server: $schema=../../../schemas/pack.schema.json
schema_version: "1.2.0"
metadata:
  name: "Billing Backend"
  version: "0.1.0"
  language: "en"
  project_type: "backend"
variables:
  required: [PROJECT_NAME, PROJECT_SLUG, DOMAIN]
requirements:
  - id: REQ-001
    title: "Charge customer at checkout"
    priority: Must
    status: Draft
outputs:
  files:
    - target: "features/billing/charge.feature"
      template: |
        Feature: Charge customer at checkout
          Scenario: Successful payment for {{PROJECT_NAME}}
            Given a valid card on file
            When the user confirms the order
            Then a CHARGE event is emitted
```

`pack lint` bloquea la publicación ante violaciones del esquema, requisitos que faltan, placeholders sin resolver e IDs duplicados.

---

---

## Aplica un domain pack a un proyecto existente

**Objetivo:** poner un pack sobre un proyecto generado en §1, dándole sus variables de plantilla.

El camino recomendado y más cómodo es `specops add` (al estilo de npm install):

```bash
# From inside your project (auto-detected project dir)
specgate specops add \
  --pack-repo https://github.com/acme/billing-specops.git \
  --pack-version v0.1.0 \
  --pack backend \
  --var PROJECT_NAME="Acme Energy Hub" \
  --var PROJECT_SLUG=acme-energy-hub \
  --var DOMAIN="community energy"
```

`add` escribe o actualiza `.specops.lock` para que las siguientes llamadas a `specops sync` / `specops diff` recuerden la fuente, la versión y las variables.

Alternativa de más bajo nivel (`expand`): el mismo comportamiento, más flags:

```bash
specgate expand \
  --pack-root ./domain-packs \
  --pack billing/backend \
  --project-dir /tmp/acme-energy-hub \
  --var PROJECT_NAME="Acme Energy Hub" \
  --var PROJECT_SLUG=acme-energy-hub \
  --var DOMAIN="community energy"
```

Para QUITAR un pack del proyecto:

```bash
specgate specops remove backend    # the pack id .specops.lock records
```

> `remove` quita la entrada de `.specops.lock` pero **no** borra los archivos generados: puede que tengas tests editados a mano que apuntan a ellos. Usa `git status` después y limpia a mano.

Efectos secundarios:

- Nuevos archivos `.feature` bajo `features/`.
- Nuevas filas en `docs/specs/traceability.md`.
- Documentos de DDD rico (`use-cases.md`, `aggregates.md`, …) rellenados o ampliados.
- Un archivo `.specops.lock` en la raíz del proyecto que registra **el repo del pack, la versión y las variables que pasaste**. Haz commit de este archivo.

Flags:

| Flag | Uso |
| --- | --- |
| `--dry-run` | Imprime las acciones sin escribir. |
| `--no-examples` | Omite los archivos marcados `seed: true` (bueno para proyectos de producción). |
| `--cache-dir <path>` | Sustituye el directorio de caché para packs remotos. |

---

---

## Construye un pack `contracts` para trabajar API-first

**Objetivo:** publicar un pack que define contratos REST/AsyncAPI y tests Pact dirigidos por el consumidor.

Fija `project_type: contracts` en `pack.yaml`. Entonces el esquema acepta dos campos extra de primer nivel:

- `api_contracts`: lista de entradas `{id, title, type, provider, consumers[], schema_ref, requirement}`.
- `consumer_driven_tests`: lista de entradas `{id, consumer, provider, pact_file, requirement}`.

Extracto de ejemplo:

```yaml
schema_version: "1.2.0"
metadata:
  name: "API Contracts Pack"
  version: "0.1.0"
  project_type: "contracts"
variables:
  required: [PROJECT_NAME, PROVIDER_SERVICE, CONSUMER_SERVICE]

api_contracts:
  - id: AC-001
    title: "Provider REST API — v1"
    type: REST
    provider: "{{PROVIDER_SERVICE}}"
    consumers: ["{{CONSUMER_SERVICE}}"]
    schema_ref: "contracts/openapi/provider-v1.yaml"
    requirement: REQ-001

consumer_driven_tests:
  - id: CDT-001
    consumer: "{{CONSUMER_SERVICE}}"
    provider: "{{PROVIDER_SERVICE}}"
    pact_file: "contracts/pacts/{{CONSUMER_SERVICE}}-{{PROVIDER_SERVICE}}.json"
    requirement: REQ-002
```

Aplicado con `expand`, un pack `contracts` genera `docs/specs/test-strategy.md`, que describe los gates de TDD (pact que falla = build que falla, reglas de cambios incompatibles, política de versionado de contratos). Combínalo con `validate --strict-tdd` para que cada `AC-NNN` tenga que trazarse a un `CDT-NNN` y a un `.feature`.

Consulta [`packs/sample-contracts/contracts/pack.yaml`](../packs/sample-contracts/contracts/pack.yaml) para ver un ejemplo completo que funciona.

---

---

## Combina varios packs con `specops.config.yaml`

**Objetivo:** declarar en un solo sitio todos los packs de los que depende un proyecto, para que un clon nuevo pueda reconstruir los specs con `specops sync`.

Crea `specops.config.yaml` en la raíz del proyecto:

```yaml
specops_version: 1
packs:
  - repo: https://github.com/acme/parking-specops.git
    version: v0.1.0
    pack_id: backend
    vars:
      PROJECT_NAME: Smart Parking
      PROJECT_SLUG: smart-parking
      DOMAIN: parking operations
  - repo: https://github.com/acme/billing-specops.git
    version: v0.2.0
    pack_id: contracts
    vars:
      PROJECT_NAME: Smart Parking
      PROVIDER_SERVICE: billing-svc
      CONSUMER_SERVICE: parking-svc
```

Luego, en un clon nuevo:

```bash
npx @rsaglobaltech/specgate@latest specops sync --project-dir .
```

Cuando falta `.specops.lock`, `sync` lee `specops.config.yaml`, expande cada pack listado y escribe el lockfile. Cuando el lockfile existe, gana el lockfile: `specops.config.yaml` es la **intención**, el lockfile es el **estado resuelto** (piensa en `package.json` frente a `package-lock.json`).

---

---

## Packs en un repositorio privado

Los packs de un equipo a menudo viven en un repositorio privado. En local se
usan tus credenciales de git. En CI, el job que escribe `specgate ci init` para
GitHub busca un secreto `SPECOPS_TOKEN`: crea un token fine-grained con acceso
de solo lectura al repositorio del pack, añádelo al repositorio del proyecto
como ese secreto, y el check de deriva podrá clonar el pack. Sin él, el check
falla con `pack_unavailable` y dice que necesita credenciales.

---

## Sube la versión de un pack con seguridad (`specops diff` + `sync`)

**Objetivo:** actualizar `parking-management/backend` de `v0.1.0` a `v0.2.0` sin sorpresas.

```bash
# 1. Preview the change (no writes)
npx @rsaglobaltech/specgate@latest specops diff \
  --project-dir ./smart-parking \
  --pack parking-management/backend \
  --pack-version v0.2.0

# Output:
# ── parking-management/backend @ v0.2.0 (current: v0.1.0) ──
#   + features/pricing/dynamic_pricing.feature
#   ~ docs/specs/use-cases.md
#   ~ docs/specs/traceability.md
#   1 added · 2 modified · 9 unchanged

# 2. Apply once you're satisfied
npx @rsaglobaltech/specgate@latest specops sync \
  --project-dir ./smart-parking \
  --pack parking-management/backend \
  --pack-version v0.2.0

# 3. Re-validate
npx @rsaglobaltech/specgate@latest validate ./smart-parking --strict

# 4. Commit the updated .specops.lock and the regenerated spec files
git add .specops.lock docs/specs features
git commit -m "chore(specs): bump parking-management/backend to v0.2.0"
```

Un `sync` simple (sin `--pack` / `--pack-version`) vuelve a expandir cada pack del lockfile usando las **variables guardadas allí**: no hace falta volver a escribir los flags `--var`.

Lo que hace `sync` con los archivos que un pack comparte con el proyecto:

- **Las líneas de trace de requisitos** (`<!-- specgate:trace … -->`) se fusionan campo a campo. Un campo que cambió el pack —un `depends` nuevo, un caso de uso renombrado— toma el valor del pack; los campos que escribió el proyecto (`status` de `apply`, enlaces) se quedan.
- **Una matriz generada** (`specgate:derived`) se regenera una vez que cada pack está sincronizado; nunca se fusiona.
- **Los catálogos de dominio** (`aggregates.md`, `events.md`, `commands.md`, `use-cases.md`, `domain-model.md`) contienen las filas de cada pack instalado: un pack sustituye las filas con sus ids y deja las demás. Cambia una fila de catálogo en el pack, no en el proyecto: la siguiente sincronización del pack la reescribe.

---

---

## Siguiente

- [El formato de pack, campo a campo](specs/domain-pack-format.md)
- [El workflow de SpecOps](specs/specops.md)
