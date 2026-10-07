# Architecture Decision Records

This directory contains the ADRs (Architecture Decision Records) for
`create-spec-driven-app`. See [CONTRIBUTING.md](../../../CONTRIBUTING.md#3-adr-policy)
for the policy on when and how to write an ADR.

## Index

| #                                              | Title                                                   | Status                 | Date       |
| ---------------------------------------------- | ------------------------------------------------------- | ---------------------- | ---------- |
| [0001](0001-node-test-over-jest.md)            | `node:test` over Jest                                   | Accepted               | 2026-05-12 |
| [0002](0002-bash-for-init-script.md)           | Bash for init script                                    | Superseded by ADR-0008 | 2026-05-12 |
| [0003](0003-javascript-for-expand.md)          | JavaScript for expand engine                            | Accepted               | 2026-05-12 |
| [0004](0004-yaml-for-pack-format.md)           | YAML for pack format                                    | Accepted               | 2026-05-12 |
| [0005](0005-multi-env-dotenv.md)               | Multi-environment `.env.*` strategy                     | Accepted               | 2026-05-12 |
| [0006](0006-node-engine-for-init.md)           | Node.js engine for `init`                               | Accepted               | 2026-05-12 |
| [0007](0007-flip-default-engine-to-node.md)    | Flip default engine to Node.js                          | Accepted               | 2026-05-12 |
| [0008](0008-remove-shell-scripts.md)           | Remove Bash engine and `validate_specs.sh`              | Accepted               | 2026-05-12 |
| [0009](0009-specops-remote-packs.md)           | SpecOps remote packs + `.specops.lock`                  | Accepted               | 2026-05-12 |
| [0010](0010-specops-sync-diff.md)              | SpecOps `sync` + `diff`                                 | Accepted               | 2026-05-12 |
| [0011](0011-contracts-pack-tdd-enforcement.md) | Contracts pack + `--strict-tdd` gate                    | Accepted               | 2026-05-13 |
| [0012](0012-plan-done-implementation-loop.md)  | `plan` + `done` implementation loop                     | Accepted               | 2026-05-13 |
| [0013](0013-harness-run-loop.md)               | `harness run` — spec-driven delivery loop for AI agents | Accepted               | 2026-05-14 |
| [0014](0014-pack-infer-heuristic.md)           | `pack infer` — heuristic .feature → pack.yaml inference | Accepted               | 2026-05-14 |
| [0015](0015-change-lifecycle.md)               | Change lifecycle — propose → review → archive           | Accepted               | 2026-08-15 |
| [0016](0016-delta-spec-format.md)              | Delta spec format — ADDED / MODIFIED / REMOVED          | Accepted               | 2026-08-15 |
| [0017](0017-agent-json-contract.md)            | The agent JSON contract                                 | Accepted               | 2026-08-15 |
| [0018](0018-artifact-schemas.md)               | Artifact schemas — a dependency graph, not a phase gate | Accepted               | 2026-08-15 |
| [0019](0019-studio-surface.md)                 | One studio surface — `csda studio`, not a standalone app | Accepted              | 2026-08-16 |
| [0020](0020-pack-format-standard.md)           | One pack format, with the JSON Schema as its authority   | Accepted               | 2026-08-17 |
| [0021](0021-alm-is-a-mirror.md)                | The ALM is a mirror; inbound work enters through a change | Accepted              | 2026-08-20 |
| [0022](0022-patterns-are-optional-principles-are-not.md) | Patterns are optional; principles are not         | Accepted              | 2026-08-21 |
| [0023](0023-checking-content-gate-or-report.md) | Checking content: a gate where it is decidable, a report where it is not | Accepted | 2026-08-26 |
| [0024](0024-the-tool-is-renamed-the-format-is-not.md) | The tool is renamed to Specgate; the on-disk format is not | Accepted | 2026-08-26 |
| [0025](0025-simulated-adoption-is-not-external-adoption.md) | Simulated adoption is GATE-G6, not GATE-G3 | Accepted | 2026-09-01 |
| [0026](0026-the-default-gate-is-the-strong-gate.md) | The default gate is the strong gate, from 1.0 | Accepted | 2026-09-02 |
| [0027](0027-use-cases-are-a-layer-not-a-column.md) | Use cases are a layer, not a column | Accepted | 2026-10-07 |
| [0028](0028-architecture-conformance-is-part-of-the-gate.md) | Architecture conformance is part of the gate | Accepted | 2026-10-07 |

## Template

Copy `docs/specs/adr/0001-node-test-over-jest.md` as a starting point, or use
the template in [CONTRIBUTING.md](../../../CONTRIBUTING.md#3-adr-policy).
