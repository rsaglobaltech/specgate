Feature: The gate's policy is a file of the repository

  @REQ-604 @SCN-604a
  Scenario: A preset and an override
    Given a project whose `.specgate/gate.yaml` says `preset: standard` and `rules: { links: off }`
    When the policy is read
    Then coverage is `warning`, links is `off`, and every other rule is `error`

  @REQ-604 @SCN-604b
  Scenario: A policy that cannot be read
    Given a `.specgate/gate.yaml` saying `preset: lax` and a rule `speed: error`
    When the developer runs `specgate validate . --strict`
    Then it exits 1 with `gate_policy_invalid`, naming `lax` and `speed` and the presets and rules to use
