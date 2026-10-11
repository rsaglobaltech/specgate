# Domain Pack Format — Contract Specification

> Authoritative reference for the `pack.yaml` schema (version `1.1.0`).
> Every key, cardinality, allowed value and example is documented here.
> The companion JSON Schema lives at [`/schemas/pack.schema.json`](../../schemas/pack.schema.json).

---

## 1. Overview

A **domain pack** is a single YAML file (`pack.yaml`) that encodes a
reusable domain model for a specific business subdomain. When consumed by
`specgate expand`, it generates Gherkin feature files, domain
documentation (traceability matrix, aggregates, commands, events, use cases)
and AI guardrails.

A pack is versioned independently of the CLI using SemVer on the
`schema_version` field.

---

## 2. Top-level structure

```yaml
schema_version: "1.1.0" # required
metadata: { ... } # required
variables: { ... } # required
requirements: [...] # required, min 1
bounded_contexts: [...] # required, min 1
use_cases: [...] # required, min 1
commands: [...] # required, min 1
aggregates: [...] # required, min 1
value_objects: [...] # optional
events: [...] # required, min 1
business_rules: [...] # optional — domain invariants
outputs: { ... } # required
rules: { ... } # required — render config, NOT domain rules
scenarios: [...] # required, min 1
```

---

## 3. Field reference

### 3.1 `schema_version`

| Property      | Value                        |
| ------------- | ---------------------------- |
| Type          | `string`                     |
| Required      | yes                          |
| Format        | SemVer (`MAJOR.MINOR.PATCH`) |
| Current value | `"1.1.0"`                    |

```yaml
schema_version: "1.1.0"
```

Breaking changes to the schema increment `MAJOR`. Additive changes
increment `MINOR`. Bug fixes increment `PATCH`.

---

### 3.2 `metadata`

| Field          | Type   | Required | Description                                                      |
| -------------- | ------ | -------- | ---------------------------------------------------------------- |
| `name`         | string | yes      | Human-readable name of the pack.                                 |
| `version`      | string | yes      | SemVer version of this pack (independent of the schema version). |
| `language`     | string | yes      | ISO 639-1 language code (e.g. `"en"`, `"es"`).                   |
| `project_type` | string | yes      | `"backend"` or `"frontend"`.                                     |
| `tier`         | string | no       | `"proven"` or `"starter"` (schema 1.5.0). Absent means starter.  |
| `provenance`   | string | no*      | What proved the pack. *Required when `tier` is `proven`.         |

`tier` says how far to trust the pack. **Proven**: derived from a product that
implemented and tested every requirement the pack ships. **Starter**: a generic
example of the format, to rewrite. `pack lint` refuses `tier: proven` without a
`provenance`, so the claim always comes with what backs it.

```yaml
metadata:
  name: "Parking Management Backend Domain Pack"
  version: "1.1.0"
  language: "en"
  project_type: "backend"
```

---

### 3.3 `variables`

Declares variables that the CLI must receive (via `--var KEY=VALUE`) before
expanding the pack. The CLI fails early if any required variable is absent.

| Field      | Type     | Required | Description             |
| ---------- | -------- | -------- | ----------------------- |
| `required` | string[] | yes      | List of variable names. |

```yaml
variables:
  required:
    - PROJECT_NAME
    - PROJECT_SLUG
    - DOMAIN
```

---

### 3.4 `requirements`

Captures the business requirements that the pack addresses.

| Field         | Type   | Required | Allowed values                                                                                                                                           |
| ------------- | ------ | -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `id`          | string | yes      | `REQ-{NNN}` (e.g. `REQ-001`). Must be unique within the pack.                                                                                            |
| `title`       | string | yes      | Short imperative statement of the requirement.                                                                                                           |
| `priority`    | string | yes      | `Must`, `Should`, `Could`, `Wont`                                                                                                                        |
| `description` | string | yes      | One-paragraph explanation in business language.                                                                                                          |
| `status`      | string | yes      | `Draft`, `Needs Clarification`, `Domain Reviewed`, `Architecture Reviewed`, `Ready for Dev`, `In Dev`, `In Review`, `Verified`, `Released`, `Deprecated` |

```yaml
requirements:
  - id: REQ-001
    title: "Alert operators when parking capacity reaches a threshold"
    priority: Must
    description: "Operators need proactive alerts when occupancy approaches capacity."
    status: Draft
```

---

### 3.5 `bounded_contexts`

Defines the DDD Lite bounded contexts covered by this pack.

| Field            | Type     | Required | Allowed values                                               |
| ---------------- | -------- | -------- | ------------------------------------------------------------ |
| `id`             | string   | yes      | `BC-{NNN}`. Unique within the pack.                          |
| `name`           | string   | yes      | Short noun phrase.                                           |
| `type`           | string   | yes      | `Core`, `Supporting`, `Generic`                              |
| `responsibility` | string   | yes      | One sentence describing the context's single responsibility. |
| `aggregates`     | string[] | yes      | Names of aggregates (must match entries in `aggregates`).    |

```yaml
bounded_contexts:
  - id: BC-001
    name: Parking Operations
    type: Core
    responsibility: "Capacity, vehicle entry, occupancy, and stay lifecycle"
    aggregates:
      - ParkingFacility
      - ParkingSession
```

---

### 3.6 `use_cases`

Maps each requirement to a command, an aggregate and a set of emitted events.

| Field         | Type     | Required | Notes                                                          |
| ------------- | -------- | -------- | -------------------------------------------------------------- |
| `id`          | string   | yes      | `UC-{NNN}`. Unique.                                            |
| `name`        | string   | yes      | Verb phrase (e.g. `"Register Vehicle Entry"`).                 |
| `actor`       | string   | yes      | Role interacting with the system (e.g. `Driver`, `Operator`).  |
| `requirement` | string   | yes      | ID of the requirement this use case implements.                |
| `command`     | string   | yes      | Name of the command dispatched (must match `commands[].name`). |
| `aggregate`   | string   | yes      | Aggregate root that handles the command.                       |
| `emits`       | string[] | yes      | Names of events emitted on success.                            |
| `scenarios`   | string[] | yes      | IDs of Gherkin scenarios (`SCN-{NNN}`).                        |
| `status`      | string   | yes      | Same allowed values as `requirements[].status`.                |

```yaml
use_cases:
  - id: UC-002
    name: Register Vehicle Entry
    actor: Driver
    requirement: REQ-002
    command: RegisterVehicleEntryCommand
    aggregate: ParkingFacility
    emits:
      - VehicleEntered
    scenarios:
      - SCN-002
    status: Draft
```

---

### 3.7 `commands`

Represents the intent to change system state.

| Field      | Type     | Required | Notes                                            |
| ---------- | -------- | -------- | ------------------------------------------------ |
| `id`       | string   | yes      | `CMD-{NNN}`. Unique.                             |
| `name`     | string   | yes      | `PascalCase` ending in `Command`.                |
| `use_case` | string   | yes      | ID of the use case that dispatches this command. |
| `fields`   | string[] | yes      | Names of the command's input fields.             |

```yaml
commands:
  - id: CMD-002
    name: RegisterVehicleEntryCommand
    use_case: UC-002
    fields:
      - facility_id
      - license_plate
      - entry_time
```

---

### 3.8 `aggregates`

Domain aggregate roots with their invariants.

| Field        | Type     | Required | Notes                                                                   |
| ------------ | -------- | -------- | ----------------------------------------------------------------------- |
| `id`         | string   | yes      | `AGG-{NNN}`. Unique.                                                    |
| `name`       | string   | yes      | `PascalCase`. Must appear in at least one `bounded_context.aggregates`. |
| `context`    | string   | yes      | Name of the bounded context that owns this aggregate.                   |
| `invariants` | string[] | yes      | Business rules the aggregate enforces. Min 1.                           |

```yaml
aggregates:
  - id: AGG-001
    name: ParkingFacility
    context: Parking Operations
    invariants:
      - "Occupancy cannot exceed facility capacity."
      - "A vehicle can enter only when a slot is available."
```

---

### 3.9 `value_objects` (optional)

Immutable objects identified by their value, not by an ID.

| Field        | Type     | Required | Notes               |
| ------------ | -------- | -------- | ------------------- |
| `id`         | string   | yes      | `VO-{NNN}`. Unique. |
| `name`       | string   | yes      | `PascalCase`.       |
| `fields`     | string[] | yes      | Constituent fields. |
| `invariants` | string[] | yes      | Validation rules.   |

```yaml
value_objects:
  - id: VO-002
    name: Money
    fields:
      - amount
      - currency
    invariants:
      - "Amount cannot be negative."
```

---

### 3.10 `events`

Domain or integration events emitted by aggregates.

| Field       | Type     | Required | Allowed values                                                   |
| ----------- | -------- | -------- | ---------------------------------------------------------------- |
| `id`        | string   | yes      | `EVT-{NNN}`. Unique.                                             |
| `name`      | string   | yes      | `PascalCase`. Past tense (e.g. `VehicleEntered`).                |
| `type`      | string   | yes      | `domain` or `integration`                                        |
| `producer`  | string   | yes      | Aggregate name that emits the event.                             |
| `consumers` | string[] | yes      | Context or service names that subscribe.                         |
| `payload`   | string[] | yes      | Field names included in the event. Always include `occurred_at`. |

```yaml
events:
  - id: EVT-002
    name: VehicleEntered
    type: domain
    producer: ParkingFacility
    consumers:
      - Billing
    payload:
      - session_id
      - facility_id
      - license_plate
      - occurred_at
```

---

### 3.11 `outputs`

Declares static files to generate during `expand`.

| Field   | Type     | Required | Notes                                                                                                  |
| ------- | -------- | -------- | ------------------------------------------------------------------------------------------------------ |
| `files` | object[] | yes      | Min 1. Each entry has `target` (output path) and `template` (template path relative to the pack root). |

```yaml
outputs:
  files:
    - target: "AI_RULES.md"
      template: "templates/AI_RULES.md.tpl"
    - target: "spec.md"
      template: "templates/spec.md.tpl"
```

---

### 3.11b `business_rules`

Invariants the domain imposes, independent of any implementation.

**Not to be confused with `rules`.** `rules` configures how the pack renders;
`business_rules` is domain content. The two shared one key until ADR-0020, and
that collision is what made every curated pack impossible to install.

| Field         | Type   | Required | Notes                                        |
| ------------- | ------ | -------- | -------------------------------------------- |
| `id`          | string | yes      | `RUL-{NNN}`.                                 |
| `title`       | string | yes      | The invariant, stated as a rule.             |
| `context`     | string | no       | The bounded context it belongs to (`BC-NNN`). |
| `description` | string | no       | Why it holds, and what violating it costs.   |

```yaml
business_rules:
  - id: RUL-001
    title: "Invoices are immutable once issued"
    context: BC-001
    description: "Corrections require credit notes, not edits."
```

---

### 3.12 `rules`

Instructs the CLI on how to update cross-cutting artefacts. This is **render
configuration**, not domain rules — those are `business_rules` above.

| Field                                | Type    | Required | Notes                                                         |
| ------------------------------------ | ------- | -------- | ------------------------------------------------------------- |
| `traceability.target`                | string  | yes      | Path to the traceability matrix relative to the project root. |
| `traceability.include_existing_rows` | boolean | yes      | Whether to preserve rows already in the matrix.               |
| `traceability.default_status`        | string  | yes      | Status assigned to new rows (e.g. `"Draft"`).                 |

```yaml
rules:
  traceability:
    target: "docs/specs/traceability.md"
    include_existing_rows: true
    default_status: "Draft"
```

---

### 3.13 `scenarios`

Links each business requirement to an executable Gherkin scenario.

**Required is what the installer needs** to render the feature file and write
the traceability row. The domain-linkage fields are optional so a pack for a
domain without CQRS is not forced to invent a command it does not have — but
they are validated when present, so a typo does not become a silent empty cell.
See [ADR-0020](adr/0020-pack-format-standard.md).

| Field                 | Type     | Required | Notes                                                                     |
| --------------------- | -------- | -------- | ------------------------------------------------------------------------- |
| `id`                  | string   | yes      | `SCN-{NNN}`. Unique.                                                      |
| `requirement_id`      | string   | yes      | ID of the requirement being verified.                                     |
| `target`              | string   | yes      | Output path for the `.feature` file (relative to project root).           |
| `template`            | string   | yes      | Template path relative to the pack root.                                  |
| `feature`             | string   | yes      | Name of the Gherkin Feature block.                                        |
| `scenario`            | string   | yes      | Name of the primary Gherkin Scenario.                                     |
| `status`              | string   | yes      | Same allowed values as `requirements[].status`.                           |
| `use_case`            | string   | no       | ID of the use case.                                                       |
| `seed`                | boolean  | no       | If `true`, the CLI writes an example Gherkin file at `target`.            |
| `command`             | string   | no       | Command name exercised in the scenario.                                   |
| `aggregate`           | string   | no       | Aggregate under test.                                                     |
| `events`              | string[] | no       | Events asserted in the Then clause.                                       |
| `technical_artifacts` | string[] | no       | Artefacts to build. Absent, the matrix renders `TBD` — which is what `plan` reads as work still to do. |
| `test_artifact`       | string   | no       | Name of the step-definition file.                                         |

```yaml
scenarios:
  - id: "SCN-002"
    requirement_id: REQ-002
    use_case: UC-002
    seed: true
    target: "features/entry_exit/vehicle_entry.feature"
    template: "templates/features/entry_exit/vehicle_entry.feature.tpl"
    feature: "Vehicle Entry"
    scenario: "Registering vehicle entry with available slot"
    command: RegisterVehicleEntryCommand
    aggregate: ParkingFacility
    events:
      - VehicleEntered
    technical_artifacts:
      - "Entry use case"
      - "VehicleEntered event"
    test_artifact: "vehicle_entry.steps"
    status: "Draft"
```

---

## 4. Versioning policy

| Change                                             | Version bump |
| -------------------------------------------------- | ------------ |
| Remove or rename a required field                  | `MAJOR`      |
| Add a new required field                           | `MAJOR`      |
| Add an optional field                              | `MINOR`      |
| Change an allowed value list in a non-breaking way | `MINOR`      |
| Correct documentation only                         | `PATCH`      |

---

## 5. Validation rules (enforced by `pack lint`)

1. All IDs within a section must be unique (e.g. no two `REQ-001`).
2. Every `use_case.requirement` must reference a declared `requirement.id`.
3. Every `use_case.command` must reference a declared `command.name`.
4. Every `use_case.aggregate` must reference a declared `aggregate.name`.
5. Every `scenario.requirement_id` must reference a declared `requirement.id`.
6. Every `scenario.use_case` must reference a declared `use_case.id`.
7. Every `scenario.id` must appear in at least one `use_cases[].scenarios`.
8. Every `aggregate.name` referenced in `bounded_context.aggregates` must appear in `aggregates`.
9. Every `event.producer` must match a declared `aggregate.name`.
10. Event payloads must include `occurred_at`.
11. `scenarios[].status` must be one of the ten allowed status values.

---

## 5a. Scenario-quality rules (`pack lint`)

A pack's scenarios are the reward signal for `harness run` — weak Gherkin
lets the harness wave through weak code. `pack lint` therefore inspects
each scenario's actual content, whether it is a `template:` `.feature.tpl`
file or inline `given`/`when`/`then` fields:

- **Broken template link** → error. The `.feature.tpl` does not exist.
- **Scenario Outline with no `Examples:`** → error. It would never run.
- **No `When` step** → the scenario exercises no action.
- **No `Then` step** → the scenario asserts nothing.
- **Fewer than 3 steps** → too thin to be a real scenario.
- **Generic title** (`test`, `Scenario 1`, fewer than 3 words) → name the
  behaviour under test.
- **Vague step language** (`works`, `correctly`, `properly`, `as
expected`, `etc`, `TODO`, `...`) → a non-falsifiable assertion.
- **Name drift** → the `pack.yaml` `scenario:` does not match the
  template's `Scenario:` title.

By default these are **warnings**. `pack lint --strict` promotes them to
**errors** — use it in CI and before a pack feeds `harness run`.

---

## 5b. Reference graph (`pack lint --graph`)

The hardest part of authoring a pack is keeping the ID cross-references
consistent by hand: `REQ-001 → UC-001 → CMD-001 / AGG-001 → EVT-001`. One
typo and the linker breaks.

`pack lint --graph` renders that spine so you can _see_ it:

```bash
# Mermaid (default) — renders natively in GitHub and VS Code
specgate pack lint --pack-root ./packs --pack billing/backend --graph

# Graphviz DOT
specgate pack lint --pack-root ./packs --pack billing/backend --graph --graph-format dot
```

- Nodes: requirements, use cases, commands/queries, aggregates, events —
  one colour per type.
- Edges: `implements`, `dispatches`/`runs`, `handled by`, `emits`.
- A reference to an ID or name that does not exist becomes a red
  **missing** node, so the break is visible in the diagram. Every
  dangling reference is also listed on stderr, and the command **exits
  non-zero** — making `--graph` usable as a CI link-check, not just a
  drawing tool.

The output is plain text: pipe it into any Mermaid/DOT renderer, commit
it to a doc, or paste it into a diagram tool. No account, no network, no
vendor dependency.

---

## 5c. Inferring a pack from a `.feature` (`pack infer`)

The default authoring flow is model-first: write `requirements` →
`use_cases` → `commands` → `events`, then the scenarios. That has a
waterfall smell — the executable artifact comes last.

`pack infer` inverts it. Write the Gherkin `.feature` first, then:

```bash
specgate pack infer --from ./drafts/capacity.feature
```

prints a proposed `pack.yaml` fragment — `requirements`, `use_cases`,
`commands`, `events`, `scenarios` — derived heuristically from the file:

| Source in the `.feature`                 | Becomes                                                  |
| ---------------------------------------- | -------------------------------------------------------- |
| `@REQ-001` tag                           | a `requirement` reference (else a `REQ-XXX` placeholder) |
| `Feature:` name                          | the `use_case` name                                      |
| `When` step                              | a proposed `command` (PascalCased)                       |
| Quoted PascalCase token in a `Then` step | a proposed `event`                                       |
| each `Scenario:`                         | a `scenarios[]` entry                                    |

The inference is **heuristic and deterministic** — no LLM, no network.
Anything it cannot infer is left as an explicit `TODO:` string, so the
fragment is a starting skeleton to review and fill in, never a
silently-guessed final answer. `--format json` emits the same model as a
structured object for tooling.

> An LLM-assisted mode (shell-out, vendor-neutral — the same pattern as
> `harness run`) is a possible follow-up behind a `--llm` flag.

---

## 6. References

- Example pack: [`tests/fixtures/domain-packs/parking-management/backend/pack.yaml`](../../tests/fixtures/domain-packs/parking-management/backend/pack.yaml)
- JSON Schema: [`schemas/pack.schema.json`](../../schemas/pack.schema.json) _(Phase 1 — P1-04)_
- Expansion engine: [`scripts/expand_domain_pack.js`](../../scripts/expand_domain_pack.js)
