# Tasks

## 1. Specification

- [x] 1.1 ADR-0015 change lifecycle
- [x] 1.2 ADR-0016 delta spec format
- [x] 1.3 ADR-0017 agent JSON contract
- [x] 1.4 ADR-0018 artifact schemas
- [x] 1.5 Write this delta by hand before the command existed

## 2. Engine

- [x] 2.1 Shared markdown AST (`parser.ts`)
- [x] 2.2 Delta validation and application (`delta.ts`)
- [x] 2.3 Diagnostic envelope (`lib/diagnostics.ts`)
- [x] 2.4 Archive engine, transactional (`archive.ts`)

## 3. Commands

- [x] 3.1 `change new` with REQ-range reservation
- [x] 3.2 `change list` / `show` / `status`
- [x] 3.3 `change validate`
- [x] 3.4 `change archive` with `--dry-run`
- [x] 3.5 CLI dispatch and help

## 4. Verification

- [x] 4.1 Unit tests for parser and delta
- [x] 4.2 Unit tests for archive, rollback and traceability upsert
- [x] 4.3 End-to-end run on a generated project
- [x] 4.4 Integrate change validation into `specgate validate`
- [x] 4.5 Document the lifecycle in docs/
