# Delta — trust-levels

## ADDED Requirements

### Requirement: REQ-678 — A map of where each requirement lives

<!-- specgate:trace status=Implemented feature=features/trust-levels/REQ-678.feature actor=Developer kind=functional -->

The system SHALL, on `specgate map [<REQ>] [--capability <c>] [--json]`, list each requirement — delivered, or in an open change as it will be once archived — with its title, capability, status, use case, actor, surfaces, route, address, feature, scenarios, code, tests and end-to-end tests; its route being the `route=` of its trace, else the first page an end-to-end test or test that names it opens (`goto`, `visit`, `get`), else none, saying which; and its address the harness's `app_url` joined to the route, when both exist.

> Phase 1 of the trust curve: an agent that knows where each feature lives can open the app and check its own work.

#### Scenario: SCN-678a — The route from an end-to-end test

- GIVEN a project with `app_url: http://localhost:5173`, REQ-031 "Cancel an order" with `uc='UC-002 Cancel an order'`, and `e2e/cancel.spec.ts` naming REQ-031 that opens `page.goto("/orders/A-1")`
- WHEN the Developer runs `specgate map REQ-031 --json`
- THEN REQ-031 has `route` "/orders/A-1", `routeFrom` "e2e", `url` "http://localhost:5173/orders/A-1", `useCase` "UC-002 Cancel an order" and `e2e` ["e2e/cancel.spec.ts"]

#### Scenario: SCN-678b — The route the trace gives, and a requirement still in its change

- GIVEN REQ-031 with `route=/orders/:id` in its trace, and REQ-040 added by the open change draft-pagos with no route
- WHEN the Developer runs `specgate map --json`
- THEN REQ-031 has `route` "/orders/:id" and `routeFrom` "trace", and REQ-040 is listed with `route` null and `routeFrom` null

### Requirement: REQ-679 — The agent is told where the requirement lives in the app

<!-- specgate:trace status=Implemented feature=features/trust-levels/REQ-679.feature actor=Developer kind=functional -->

The system SHALL, when it builds the prompt the harness hands an agent for a requirement whose map entry has a route or end-to-end tests, add a section "Where it lives in the app" with the route, the address and those tests; and, when `app_url` is set, tell the agent to open that address with its browser tool before changing anything and again after, and to check the behaviour the scenarios describe.

#### Scenario: SCN-679a — Opened before and after

- GIVEN the project of SCN-678a
- WHEN the harness builds the prompt for REQ-031
- THEN it has "Where it lives in the app" with "/orders/A-1", "http://localhost:5173/orders/A-1" and "e2e/cancel.spec.ts", and asks the agent to open the address before and after the change

### Requirement: REQ-680 — Apply keeps the evidence of each delivery

<!-- specgate:trace status=Implemented feature=features/trust-levels/REQ-680.feature actor=Developer kind=functional -->

The system SHALL, when `specgate apply <REQ>` marks a requirement delivered after running its scenarios, write `.specgate/evidence/<REQ>/evidence.json` with the requirement, the date, the command that ran its scenarios, its exit code and duration; `bdd.log` with that command's output; and, under `artifacts/`, the files its browser tests left in `test-results/` during that run — screenshots, traces, videos —; and SHALL keep `artifacts/` out of git with `.specgate/evidence/.gitignore`.

#### Scenario: SCN-680a — Delivered, with its screenshot

- GIVEN a project with `bdd: required` and a `bdd_cmd` that passes for `@REQ-031` and writes `test-results/cancel/screenshot.png`
- WHEN the Developer runs `specgate apply REQ-031`
- THEN `.specgate/evidence/REQ-031/evidence.json` names the command with exit code 0, `bdd.log` holds its output, `artifacts/cancel/screenshot.png` exists, and `.specgate/evidence/.gitignore` ignores `artifacts/`
