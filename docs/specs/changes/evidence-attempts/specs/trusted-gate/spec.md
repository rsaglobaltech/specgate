# Delta — trusted-gate

## ADDED Requirements

### Requirement: REQ-819 — A failed delivery is kept as an attempt

<!-- specgate:trace actor=Developer kind=functional -->

The system SHALL, when `specgate apply` runs a requirement's scenarios and they fail, keep the run as `.specgate/evidence/<REQ>/attempts/<n>/` — `run.json`, `run.log` and the artifacts the run wrote, out of git, `n` counting from 1 — and name it in `apply_bdd_failed`; SHALL list the attempts in the delivery's `evidence.json` and on the evidence page, each with the scenarios that failed and why, and what the AI model decided in it; and SHALL remove them when a new before is taken.

#### Scenario: SCN-819a — Flaky, then delivered

- GIVEN REQ-031 whose scenarios fail twice — the AI log saying `{"category":"A"}` — and then pass
- WHEN the Developer runs `specgate apply REQ-031` three times, then `specgate evidence draft-orders`
- THEN attempts 1 and 2 are kept, the first refusal names `attempts/1`, `evidence.json` lists both, and the page's "Failed attempts" shows each with `Received: 202` and `{"category":"A"}`
