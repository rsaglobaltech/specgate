Feature: The policy is configured, and a new project starts standard

  @REQ-606 @SCN-606a
  Scenario: Set through config
    Given a project with no policy
    When the developer runs `specgate config set gate.rules.coverage off`, then `specgate config set gate.preset loose`
    Then `.specgate/gate.yaml` holds `coverage: off`, and the second exits 2 with `config_value_invalid` naming minimal, standard and strict

  @REQ-606 @SCN-606b
  Scenario: A new project's policy
    Given an empty folder
    When the developer runs `specgate init --no-ci`
    Then `.specgate/gate.yaml` says `preset: standard` and lists the seven rules
