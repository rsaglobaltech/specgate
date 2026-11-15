Feature: A principle can be checked by the gate

  @REQ-331 @SCN-331a
  Scenario: A forbidden pattern in the code
    Given principle P1 says `forbid="password\s*=\s*\"" in="src/**"` and src/config.ts holds `password = "x"`
    When the developer runs `specgate check --json`
    Then the gate fails with `principle_failed` naming P1 and src/config.ts:1

  @REQ-331 @SCN-331b
  Scenario: A principle given as advice
    Given principle P2 says `run="node -e process.exit(3)" level=warn`, and principle P3 says `run="node -e process.exit(0)"`
    When the developer runs `specgate check --json`
    Then the gate passes with a warning `principle_failed` naming P2, and nothing about P3
