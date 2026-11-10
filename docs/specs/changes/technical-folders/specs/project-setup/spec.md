# Delta — project-setup

## ADDED Requirements

### Requirement: REQ-476 — Folders named by the kind of code are not areas

The system SHALL, when `onboard` and `adopt` read areas off a directory's children, leave out each child named by a generic kind of code — components, hooks, helpers, types, styles, store, utils, lib, shared and the others ADR-0041 lists — and SHALL propose no area from a directory where at least two children, and at least half of them, are named by a kind of code, the architectural layers included: that directory is organised by kind of code, not by what the product does. A layer name alone, such as `core` beside real areas, stays an area.

#### Scenario: SCN-476a — A React CLI split by kind of code

- GIVEN a TypeScript project whose `src/` holds `components`, `keymap`, `hooks`, `utils` and `data`
- WHEN the developer runs `specgate onboard`, then `specgate adopt --yes`
- THEN `onboard` proposes no area and says the code is organised by kind, `adopt` writes no `docs/specs/adoption.md`, and spec.md has REQ-001 alone

#### Scenario: SCN-476b — Areas beside a utils folder

- GIVEN a project whose `src/` holds `billing`, `invoices` and `utils`
- WHEN the developer runs `specgate onboard`
- THEN it proposes the areas Billing and Invoices, and not Utils

<!-- specgate:trace status=Implemented actor=Developer kind=business-rule -->

### Requirement: REQ-477 — After adoption, onboard points at one behaviour, not a folder

The system SHALL, when `onboard` runs on an adopted project, name `specgate new "<a behaviour you rely on>"` as the next command — with `docs/specs/adoption.md` when adoption found areas — and never a change named after a folder.

#### Scenario: SCN-477a — onboard on an adopted project with areas

- GIVEN a project adopted with the areas Billing and Invoices
- WHEN the developer runs `specgate onboard --json`
- THEN its next command is `specgate new "<a behaviour you rely on>"`, not `specgate propose describe-billing`

<!-- specgate:trace status=Implemented actor=Developer kind=functional -->

### Requirement: REQ-478 — The adoption baseline names no path that is not one

The system SHALL seed the adoption baseline REQ-001 with no test and no code artifact, rather than the test command and the words "existing codebase" in their place, so that `plan` reports no missing file for it; it is closed, as any requirement, once a test names REQ-001, and `harness run` takes it only when it is named with `--req`, since an agent cannot build existing behaviour.

#### Scenario: SCN-478a — plan right after adoption

- GIVEN a Node project just adopted
- WHEN the developer runs `specgate plan --format json`
- THEN no finding names `npm test` or `existing codebase` as a missing file for REQ-001

<!-- specgate:trace status=Implemented actor=Developer kind=functional -->
