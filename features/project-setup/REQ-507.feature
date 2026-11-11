Feature: config set writes agent profiles

  @REQ-507 @SCN-507a
  Scenario: A profile written, then a bad price refused
    Given a project with no `.harness/profiles.yaml`
    When a tool runs `specgate config set profiles.fast.agent "claude -p < {prompt_file}"` and `specgate config set profiles.fast.price_per_input_token 0.000003`, then `specgate config set profiles.fast.price_per_output_token cheap --json`
    Then `.harness/profiles.yaml` declares `fast` with that agent and price, which `harness run --profile fast` reads; the last exits 2 with `config_value_invalid` and a fix, and the file is unchanged
