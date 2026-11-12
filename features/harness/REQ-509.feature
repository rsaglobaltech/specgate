Feature: The harness report gives the measured cost beside the estimate

  @REQ-509 @SCN-509a
  Scenario: One profile measured, one only estimated
    Given `.harness/profiles.yaml` where `fast` declares `price_per_input_token: 0.000001` and `price_per_output_token: 0.000005` and `cheap` declares only `cost_per_run_hint: 0.2`, and a recorded run where `fast` used 1000 input and 200 output tokens and `cheap` ran once with no tokens recorded
    When a tool runs `specgate harness report --json`
    Then `fast` has `measured` 0.002 and `basis` `measured`, `cheap` has `estimated` 0.2, `measured` null and `basis` `estimated`, and `measuredCost.total` is 0.002
