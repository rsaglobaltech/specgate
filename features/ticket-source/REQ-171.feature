Feature: The check says where the change will go

  @REQ-171 @SCN-171a
  Scenario: A story without an epic
    Given a Specgate project with the capability `billing`, and the story PAY-123, ready, with no epic
    When the developer runs `specgate propose --from-ticket PAY-123.json --check --json`
    Then it reports `ready` true and `capability` null, and warns `ticket_no_capability` naming `billing`; with `--capability billing` it reports `capability` "billing" and no such warning
