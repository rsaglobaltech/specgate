<!-- csda:allow-placeholders — this guide quotes the {{VAR}} template syntax. -->

# Domain packs

Reusable, versioned domain knowledge. A pack is to a spec tree what a
dependency is to code: you install it, you pin it, and you upgrade it
deliberately.

<!-- csda:diagram three-repos -->

---

## Author a domain pack from scratch

**Goal:** package a reusable bundle of requirements, use cases, aggregates, events, and Gherkin templates.

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

Minimum viable `pack.yaml`:

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

`pack lint` blocks publication on schema violations, missing requirements, unresolved placeholders, and duplicate IDs.

---

---

## Apply a domain pack to an existing project

**Goal:** layer a pack onto a project generated in §1, supplying its template variables.

The recommended ergonomic path is `specops add` (npm-install-style):

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

`add` writes/updates `.specops.lock` so subsequent `specops sync` / `specops diff` calls remember the source, version, and vars.

Lower-level alternative (`expand`) — same behaviour, more flags:

```bash
specgate expand \
  --pack-root ./domain-packs \
  --pack billing/backend \
  --project-dir /tmp/acme-energy-hub \
  --var PROJECT_NAME="Acme Energy Hub" \
  --var PROJECT_SLUG=acme-energy-hub \
  --var DOMAIN="community energy"
```

To take a pack OFF the project:

```bash
specgate specops remove parking-management/backend
```

> `remove` drops the entry from `.specops.lock` but does **not** delete generated files — you might have hand-edited tests pointing at them. Use `git status` afterwards and clean up by hand.

Side effects:

- New `.feature` files under `features/`.
- New rows in `docs/specs/traceability.md`.
- Rich-DDD docs (`use-cases.md`, `aggregates.md`, …) populated/extended.
- A `.specops.lock` file at the project root recording **pack repo, version, and the vars you passed**. Commit this file.

Flags:

| Flag | Use |
| --- | --- |
| `--dry-run` | Print actions without writing. |
| `--no-examples` | Skip files marked `seed: true` (good for production projects). |
| `--cache-dir <path>` | Override the cache directory for remote packs. |

---

---

## Build a `contracts` pack for API-first work

**Goal:** ship a pack that defines REST/AsyncAPI contracts and consumer-driven Pact tests.

Set `project_type: contracts` in `pack.yaml`. The schema then accepts two extra top-level fields:

- `api_contracts` — list of `{id, title, type, provider, consumers[], schema_ref, requirement}` entries.
- `consumer_driven_tests` — list of `{id, consumer, provider, pact_file, requirement}` entries.

Example excerpt:

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

When applied with `expand`, a `contracts` pack generates `docs/specs/test-strategy.md` describing the TDD gates (failing pact = failing build, breaking-change rules, contract versioning policy). Pair it with `validate --strict-tdd` so every `AC-NNN` must trace to a `CDT-NNN` and a `.feature`.

Browse [`packs/sample-contracts/contracts/pack.yaml`](../packs/sample-contracts/contracts/pack.yaml) for a complete working example.

---

---

## Compose multiple packs with `specops.config.yaml`

**Goal:** declare every pack a project depends on in one place, so a fresh clone can rebuild specs with `specops sync`.

Create `specops.config.yaml` at the project root:

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

Then on a fresh clone:

```bash
npx @rsaglobaltech/specgate@latest specops sync --project-dir .
```

When `.specops.lock` is absent, `sync` reads `specops.config.yaml`, expands every listed pack, and writes the lockfile. When the lockfile exists, the lockfile wins — `specops.config.yaml` is the **intent**, the lockfile is the **resolved state** (think `package.json` vs `package-lock.json`).

---

---

## Bump a pack version safely (`specops diff` + `sync`)

**Goal:** upgrade `parking-management/backend` from `v0.1.0` to `v0.2.0` without surprises.

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

Plain `sync` (no `--pack` / `--pack-version`) re-expands every pack in the lockfile using the **vars persisted there** — no need to retype `--var` flags.

---

---

## Next

- [The pack format, field by field](specs/domain-pack-format.md)
- [The SpecOps workflow](specs/specops.md)
