Feature: A pause between attempts

  @REQ-591 @SCN-591a
  Scenario: Stopped at the pause
    Given a run with `--pause-between-attempts` and `--max-attempts 3` whose first attempt fails
    When the person runs `specgate harness continue --stop`
    Then the requirement ends failed after one attempt
