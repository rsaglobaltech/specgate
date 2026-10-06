# Test Strategy — {{PROJECT_NAME}} Contract Layer

**Project:** {{PROJECT_NAME}} (`{{PROJECT_SLUG}}`)
**Provider:** {{PROVIDER_SERVICE}}
**Consumer:** {{CONSUMER_SERVICE}}
**Date:** <!-- filled in at expand time -->
**Status:** Draft

## Overview

This document describes the contract-testing strategy for the `{{PROJECT_SLUG}}` project.
It follows the **Consumer-Driven Contract Testing** (CDCT) pattern, where consumers publish their
expected interactions (Pact files) and providers verify them in CI before any release.

## Testing Pyramid

```
          ┌───────────────────┐
          │   E2E / Integration│   ← minimal; catch wiring errors only
          ├───────────────────┤
          │  Contract Tests    │   ← primary gate; Pact consumer + provider
          ├───────────────────┤
          │    Schema Tests    │   ← validate OpenAPI / AsyncAPI files on every commit
          ├───────────────────┤
          │    Unit Tests      │   ← serialisation, mapping, validation logic
          └───────────────────┘
```

## TDD Rules Enforced by `validate --strict-tdd`

| Rule | Check | Gate |
|------|-------|------|
| **TDD-1** | Every `AC-*` has at least one `CDT-*` linking it | Pre-merge |
| **TDD-2** | No `Test Artifact = TBD` when Status ≥ `In Dev` | Pre-merge |
| **TDD-3** | Every requirement has a traceability row | Pre-merge |
| **TDD-4** | No duplicate scenario/contract IDs | Pre-merge |
| **TDD-5** | Breaking-change rules documented for every `AC-*` | Pre-merge |
| **TDD-6** | Schema files referenced by `schema_ref` must exist on disk | Pre-merge |

## Contract Test Workflow

### Consumer side

1. Write a failing Pact test describing the expected HTTP interaction.
2. Run the Pact test — it generates `contracts/pacts/{{CONSUMER_SERVICE}}-{{PROVIDER_SERVICE}}.json`.
3. Commit the Pact file alongside the consumer feature.
4. Open a PR — CI runs `validate --strict` to confirm the Pact file is registered.

### Provider side

1. Pull the latest Pact file from the repository (or Pact Broker if configured).
2. Run provider verification: `pact-provider-verifier` or the framework-native equivalent.
3. Only after verification passes may the provider merge a change that touches a contracted endpoint.

## Schema Validation

OpenAPI files are validated on every CI run:

```bash
npx @redocly/cli lint contracts/openapi/provider-v1.yaml
```

AsyncAPI files:

```bash
npx @asyncapi/cli validate contracts/asyncapi/provider-events-v1.yaml
```

These commands run in the `contract-lint` CI step before any contract tests.

## Breaking-Change Detection

Before merging any change to a `contracts/` schema file:

1. Run `oasdiff breaking contracts/openapi/provider-v1.yaml contracts/openapi/provider-v1-proposed.yaml`.
2. If any breaking change is detected, increment the major version and update `pack.yaml`.
3. Maintain the old version for consumers still pinned to it.

## Coverage Requirements

| Metric | Threshold |
|--------|-----------|
| Pact interactions per endpoint | ≥ 1 happy path + ≥ 1 error path |
| Provider verification pass rate | 100% on main |
| Schema lint errors | 0 on main |
| The gate (`validate --strict`)            | Must pass on every PR |

## References

- API Contracts: `pack.yaml` → `api_contracts[]`
- Consumer-Driven Tests: `pack.yaml` → `consumer_driven_tests[]`
- Breaking-Change Rules: `pack.yaml` → `breaking_change_rules[]`
- AI Rules: `AI_RULES.md`
- Traceability: `docs/specs/contract-traceability.md`
