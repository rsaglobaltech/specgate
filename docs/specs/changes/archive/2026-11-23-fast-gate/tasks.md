# Tasks

## 1. Specification

- [x] 1.1 Write the delta spec (REQ-510 … REQ-519)
- [x] 1.2 Run `specgate change validate`

## 2. Implementation

- [x] 2.1 REQ-510 — check --affected runs the tests of what the change touches
- [x] 2.2 REQ-511 — a change to what every test depends on runs the whole suite
- [x] 2.3 REQ-512 — when nothing maps, the whole suite runs, and says why
- [x] 2.4 REQ-513 — the test command takes the selected files
- [x] 2.5 REQ-514 — the whole suite stays the default, and CI always runs it
- [x] 2.6 REQ-515 — apply runs the tests of the requirement it delivers
- [x] 2.7 REQ-516 — a test that passed on the same code is not run again
- [x] 2.8 REQ-517 — validate, status and matrix grow linearly with the project
- [x] 2.9 REQ-518 — the architecture check and the tests run side by side
- [x] 2.10 REQ-519 — each stage says how long it took
- [x] 2.11 the CHANGELOG, the harness.config.yaml template, `types/api.d.ts` and the docs
