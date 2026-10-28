Feature: A check that could not run is the person's

  @REQ-267 @SCN-267a
  Scenario: A scanner that fails before it reports
    Given a gate check with `sarif:` whose command exits 2 and writes nothing, an agent that writes a file, and three attempts allowed
    When `harness run` reaches the check
    Then it makes one attempt, and says the check could not run, without "Fix what the check found"
