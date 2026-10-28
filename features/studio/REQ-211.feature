Feature: The agent is chosen per run from the profiles

  @REQ-211 @SCN-211a
  Scenario: A run with a chosen profile
    Given `.harness/profiles.yaml` declares `fast` and `deep`, and the configured agent is `fast`
    When `specgate harness run --req REQ-002 --profile deep --dry-run` runs
    Then the agent it would run is `deep`'s

  @REQ-211 @SCN-211b
  Scenario: An unknown profile is refused
    Given the profiles `fast` and `deep`
    When a run asks for `--profile other`
    Then it is refused naming `fast` and `deep`

  @REQ-211 @SCN-211c
  Scenario: The studio lists the profiles
    Given the profiles `fast`, whose agent pipes into `specgate harness events --from claude`, and `deep` with a cost hint of 1.9
    When the studio reads the profiles
    Then `fast` streams usage and is the default, and `deep` carries its cost hint
