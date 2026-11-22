@change:scenarios-run
Feature: A requirement's scenarios run one by one

  @REQ-666 @SCN-666a
  Scenario: One scenario passes, one fails
    Given REQ-031's feature with SCN-031a and SCN-031b, and a `bdd_cmd` that passes only `@SCN-031a`
    When the Developer runs `specgate scenarios REQ-031 --json`
    Then SCN-031a passed and SCN-031b did not, each with its line, and the answer exits 1 with `scenario_failed` naming SCN-031b

  @REQ-666 @SCN-666b
  Scenario: No runner
    Given a project with no `bdd_cmd`
    When the Developer runs `specgate scenarios REQ-031 --json`
    Then it is refused with `bdd_cmd_missing`, its fix `specgate config set bdd_cmd`
