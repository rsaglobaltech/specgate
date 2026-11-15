# Drift and API contracts

Two checks that keep the code from moving away from the specification
between pull requests: behaviour that changed without a requirement, and a
requirement that names an API operation that is not there.

## Behaviour changed without a specification

`specgate check` lists each commit since the base that changes production code,
names no requirement (`REQ-NNN`) in its message, and changes no test that names
one: the warning `spec_drift`, with the commit and its files (REQ-333). Tests,
specs, features, docs and build configuration are not production code; the
harness's commits name their requirement, so they never drift.
`specgate drift [--base <branch>] [--json]` prints the same for CI. With
`drift: gate` in harness.config.yaml it fails both (REQ-334); `drift: off` stops
looking.

## A requirement that points at an API operation

A requirement can name the operation it specifies in its trace comment:
`api=openapi.yaml#/paths/~1positions/post` (a JSON pointer),
`api=openapi.yaml#reportPosition` or a bare `api=reportPosition`. `validate`
reads OpenAPI and AsyncAPI, YAML or JSON, and fails with `api_operation_missing`
or `api_contract_missing` when it is not there (REQ-335).
`specgate contract check` lists, per contract, the operations no requirement
cites and the references that do not resolve (REQ-336).

## Next

- [Validating](validating.md) — the gate, locally and in CI
- [Workspace](workspace.md) — several repositories, and the contracts between them
