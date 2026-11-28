# Delta — trusted-gate

## ADDED Requirements

### Requirement: REQ-809 — The evidence keeps what a workspace's runner wrote

<!-- specgate:trace status=Implemented actor=Developer kind=functional -->

The system SHALL, when it keeps the evidence of a requirement's scenarios (`apply`, `evidence before`, `reproduce run`), copy the files written during that run under `test-results/` and under the `test-results/` of each workspace the root `package.json` declares, a workspace's files under `artifacts/<workspace>/`.

> Reported on 2026-11-27: Playwright ran in `apps/web` and wrote `apps/web/test-results/`; the evidence kept nothing.

#### Scenario: SCN-809a — A screenshot in a workspace

- GIVEN a project whose `package.json` declares the workspace `apps/*`, and a `bdd_cmd` that writes `apps/web/test-results/flow/test-finished-1.png`
- WHEN the Developer runs `specgate evidence before REQ-001`
- THEN `.specgate/evidence/REQ-001/before/artifacts/apps/web/flow/test-finished-1.png` exists, and `run.json` lists it

### Requirement: REQ-810 — Doctor sees a workspace's runner and its Playwright config

<!-- specgate:trace status=Implemented actor=Developer kind=functional -->

The system SHALL, in `specgate doctor`, count the scenarios as executed when `bdd_cmd` is set or the root or a declared workspace has a Gherkin runner (playwright-bdd among them); and SHALL check for screenshots and video the Playwright config at the root or, when there is none, in a declared workspace, whenever `bdd_cmd` names Playwright or that config uses playwright-bdd.

> Reported on 2026-11-27: with playwright-bdd in `apps/web` and `bdd_cmd` set to an npm script, doctor said nothing executes the scenarios, and never named the missing screenshots.

#### Scenario: SCN-810a — playwright-bdd in a workspace

- GIVEN a project with `bdd_cmd: npm run test:bdd -- --grep "{tags}"`, the workspace `apps/web` whose `playwright.config.ts` uses playwright-bdd with no `screenshot` or `video`, and a well-formed feature file
- WHEN the Developer runs `specgate doctor`
- THEN the scenarios line does not say "no Gherkin runner", and `doctor_evidence_media` is reported
