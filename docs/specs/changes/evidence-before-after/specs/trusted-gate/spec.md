# Delta — trusted-gate

## ADDED Requirements

### Requirement: REQ-803 — A requirement's run before its code is kept as its before

<!-- specgate:trace actor=Developer kind=functional -->

The system SHALL keep, as `.specgate/evidence/<REQ>/before/`, a run of the requirement's scenarios made before its code — when a person seals the acceptance tests in a project with `bdd: required`, when `specgate reproduce run` sees a bug red, and when the Developer runs `specgate evidence before <REQ>` — with the command, its exit code, its duration, the end of its output, and the files the runner wrote under `test-results/` during it; whether the run passed or failed.

#### Scenario: SCN-803a — Before the code, red

- GIVEN `bdd: required`, a `bdd_cmd` whose run for REQ-031 fails and writes `test-results/checkout/screenshot.png`
- WHEN the Developer runs `specgate evidence before REQ-031`
- THEN `.specgate/evidence/REQ-031/before/run.json` holds the command with `@REQ-031` and a non-zero exit code, and `before/artifacts/checkout/screenshot.png` exists

### Requirement: REQ-804 — A delivery keeps its after beside its before

<!-- specgate:trace actor=Developer kind=functional -->

The system SHALL write the evidence `apply` keeps (REQ-680) to `.specgate/evidence/<REQ>/after/`, leave `before/` as it is, and read a requirement's evidence from `after/` first and then from the layout before this change.

#### Scenario: SCN-804a — Delivered after its before

- GIVEN REQ-031 with a before
- WHEN `specgate apply REQ-031` delivers it with its scenarios green
- THEN `.specgate/evidence/REQ-031/after/run.json` has exit code 0, and `before/run.json` is unchanged

### Requirement: REQ-805 — Doctor says when the runner keeps no pictures

<!-- specgate:trace actor=Developer kind=functional -->

The system SHALL warn, on `specgate doctor`, with `evidence_media_off` when `bdd_cmd` runs Playwright and its config does not set `screenshot` and `video` under `use`, the fix naming the lines to add; and SHALL say nothing of a runner it does not read.

#### Scenario: SCN-805a — Playwright without screenshots

- GIVEN `bdd_cmd` runs `npx bddgen && npx playwright test`, and `playwright.config.ts` with no `screenshot:` under `use`
- WHEN the Developer runs `specgate doctor`
- THEN it warns `evidence_media_off`, its fix naming `screenshot: 'on'` and `video: 'on'`

### Requirement: REQ-806 — A requirement is drawn before and after, the same way every time

<!-- specgate:trace actor=Developer kind=functional -->

The system SHALL draw, as Mermaid, a sequence diagram of each scenario of a requirement — its actor, the system, and each `METHOD /path` its steps name — from the spec at the base and from the spec now, and a class diagram of the files its code column links — their classes, public members and parents — at the base and now, for TypeScript, JavaScript, Java, Kotlin, C# and Python; the same input giving the same text.

#### Scenario: SCN-806a — A call added to a flow

- GIVEN REQ-031 whose scenario at the base sends `POST /api/orders`, and now also `POST /api/payments`
- WHEN its diagrams are drawn
- THEN the before has one call and the after two, both from the actor to the system

#### Scenario: SCN-806b — A method added to a class

- GIVEN `src/orders.ts`, linked to REQ-031, whose class `Orders` has `place()` at the base and `place()` and `refund()` now
- WHEN its diagrams are drawn
- THEN the after's class `Orders` lists `refund()`, marked as added

### Requirement: REQ-807 — One page shows a change's evidence

<!-- specgate:trace actor=Developer kind=functional -->

The system SHALL write, on `specgate evidence <change>`, `docs/specs/changes/<change>/EVIDENCE.md`: per requirement of the change, its before and after side by side — the first and last screenshot of each scenario, copied beside the page when under 300 KB —, its diagrams, and the paths of its videos and traces; and, for a requirement with no before, no after or no pictures, a line saying which and the command that gets it.

#### Scenario: SCN-807a — One before, one missing

- GIVEN draft-orders with REQ-031, which has a before and an after with screenshots, and REQ-032, delivered with no before
- WHEN the Developer runs `specgate evidence draft-orders`
- THEN EVIDENCE.md shows REQ-031's two screenshots side by side, and says REQ-032 has no before with `specgate evidence before REQ-032`
