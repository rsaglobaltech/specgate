Feature: A requirement no test proved ends unverified, never passed

  @REQ-649 @SCN-649a
  Scenario: No test command
    Given a scaffolded project with no test command and an agent that writes REQ-000's code
    When the Developer runs `specgate harness run --req REQ-000 --max-attempts 3 --format json`
    Then the run warns "No test command", REQ-000 ends unverified after one attempt, its branch's last commit says it is UNVERIFIED, the matrix does not say it is implemented, and the run does not pass
