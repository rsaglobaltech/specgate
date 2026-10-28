Feature: forja is found, or the person is told how to get it

  @REQ-236 @SCN-236a
  Scenario: No forja anywhere
    Given no `forja` on the PATH, no `SPECGATE_FORJA_CMD`, and an npm registry that does not have `@rsaglobaltech/forja`
    When `specgate init --forja fleet --backend spring` runs
    Then it exits with an error naming `npm i -g @rsaglobaltech/forja` and `SPECGATE_FORJA_CMD`, and runs nothing

  @REQ-236 @SCN-236b
  Scenario: forja learns the Specgate that called it
    Given a forja that records its environment
    When `specgate init --forja shop` runs
    Then forja sees `SPECGATE_VERSION` set to Specgate's own version
