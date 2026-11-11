# Delta — harness

## ADDED Requirements

### Requirement: REQ-502 — The harness report for one capability

The system SHALL accept `--capability <name>` on `specgate harness report` and then summarise only the recorded results of the requirements of that capability, naming it as `capability` in `report` of the JSON answer; and SHALL refuse a capability the project does not have with `capability_unknown`, exit 2, whose fix lists the capabilities it has.

#### Scenario: SCN-502a — Two runs over two capabilities

- GIVEN a project whose REQ-002 is in the capability `orders` and REQ-003 in `billing`, and a recorded run where REQ-002 passed and REQ-003 failed
- WHEN a tool runs `specgate harness report --json --capability orders`
- THEN `report.capability` is `orders`, one requirement was attempted and it passed

<!-- specgate:trace status=Implemented actor=Developer kind=functional -->

### Requirement: REQ-509 — The harness report gives the measured cost beside the estimate

The system SHALL record, for each agent step of an attempt whose stream reported its tokens, the profile and its input, output, cache-read and cache-write tokens in the run's ledger; and `specgate harness report --json` SHALL give `costByProfile`, one entry per profile that ran, with its attempts, its tokens, the `estimated` cost from `cost_per_run_hint`, the `measured` cost from its tokens and the prices per token the profile declares in `.harness/profiles.yaml` (`price_per_input_token`, `price_per_output_token`, and `price_per_cache_read_token` and `price_per_cache_write_token`, which default to the input price), and `basis`: `measured` when its cost could be measured, `estimated` when only the hint gives one, and null when neither; and `measuredCost` with the total, the attempts measured and those not measured, or null when none was.

#### Scenario: SCN-509a — One profile measured, one only estimated

- GIVEN `.harness/profiles.yaml` where `fast` declares `price_per_input_token: 0.000001` and `price_per_output_token: 0.000005` and `cheap` declares only `cost_per_run_hint: 0.2`, and a recorded run where `fast` used 1000 input and 200 output tokens and `cheap` ran once with no tokens recorded
- WHEN a tool runs `specgate harness report --json`
- THEN `fast` has `measured` 0.002 and `basis` `measured`, `cheap` has `estimated` 0.2, `measured` null and `basis` `estimated`, and `measuredCost.total` is 0.002

<!-- specgate:trace status=Implemented actor=Developer kind=functional -->
