Feature: The quality checks are read, validated and listed

  @REQ-218 @SCN-218a
  Scenario: A valid list of checks
    Given harness.config.yaml with `quality: strict` and two checks, spotbugs at attempt and pit at end
    When `specgate quality list --json` runs
    Then both are listed with their stage and whether they gate, and the thresholds are the strict level's, 85 and 70

  @REQ-218 @SCN-218b
  Scenario: A secret written into the file is refused
    Given a check whose `env` says `SONAR_TOKEN=abc`
    When the configuration is read
    Then it is refused saying env lists names only, and nothing runs

  @REQ-218 @SCN-218c
  Scenario: A host folder mounted into a container is refused
    Given a check whose `volumes` lists `/home/me:/data`
    When the configuration is read
    Then it is refused saying a volume is name:/path, never a host folder
