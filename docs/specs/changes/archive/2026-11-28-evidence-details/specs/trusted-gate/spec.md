# Delta — trusted-gate

## ADDED Requirements

### Requirement: REQ-815 — The page says why each scenario was red

<!-- specgate:trace status=Implemented actor=Developer kind=functional -->

The system SHALL show on the evidence page, per requirement, one row per scenario its runner reported, read from Playwright's list output kept with the before and the after: on each side whether it passed or failed, its time, and for a failure the step that failed and its `Error:`, `Expected:` and `Received:` lines.

#### Scenario: SCN-815a — Red before, green after

- GIVEN REQ-031 whose before log has `✘ … › Paying @REQ-031 (18.7s)` failing at `Then the response is 422` with `Expected: 422` and `Received: 500`, and whose after log has `✓ … › Paying @REQ-031 (10.5s)`
- WHEN the Developer runs `specgate evidence draft-orders`
- THEN the page's row for Paying shows ✘ 18.7s with `Expected: 422 · Received: 500` before, and ✓ 10.5s after

### Requirement: REQ-816 — The page shows each call to the service, before and after

<!-- specgate:trace status=Implemented actor=Developer kind=functional -->

The system SHALL read each Playwright `trace.zip` kept with a requirement's before and after and show on the page each call its tests made to the project's service — a path under `/api/` or a call made through the test's request context — with its method, path, status and its request and response bodies, paired before and after by method and path — a path segment that is a record's number (digits, a UUID, `INC-2026-000007`) read as `{id}`, and a body that differs only in such a number not shown as changed —, every JSON value whose key names a token, password, secret, cookie or authorization replaced by `«hidden»`; and `specgate doctor` SHALL ask for `trace: 'on'` beside screenshots and video.

#### Scenario: SCN-816a — 500 then 422

- GIVEN REQ-031's before trace with `POST /api/orders` answered 500, and its after trace with the same call answered 422 `{"code":"order_unclear"}`, and a `POST /api/session` answered `{"token":"abc"}`
- WHEN the Developer runs `specgate evidence draft-orders`
- THEN the page shows `POST /api/orders` with 500 before and 422 after, the after's body with `order_unclear`, and the session's token as `«hidden»`, never `abc`

### Requirement: REQ-817 — The page shows what the AI model decided

<!-- specgate:trace status=Implemented actor=Developer kind=functional -->

The system SHALL set `SPECGATE_AI_LOG` to the absolute path of `test-results/specgate/ai-decisions.jsonl`, emptied first, on every run of a requirement's scenarios it makes (`evidence before`, `apply`, `reproduce run`), keep that file with the run's artifacts, and show its lines on the evidence page, before and after: each line's `model`, `input`, `output` and `ms`.

#### Scenario: SCN-817a — The model's verdict

- GIVEN a `bdd_cmd` that writes `{"model":"llama3.2","input":"Haz eso","output":{"category":"C"},"ms":812}` to `$SPECGATE_AI_LOG`
- WHEN the Developer runs `specgate evidence before REQ-031`, then `specgate evidence draft-orders`
- THEN the page shows, before, `llama3.2`, `Haz eso`, `{"category":"C"}` and `812 ms`
