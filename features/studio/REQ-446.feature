Feature: A ticket reviewed before its change is opened

  @REQ-446 @SCN-446a
  Scenario: A story without an epic
    Given a project with the capabilities `billing` and `orders`, and the story PAY-123, ready, with no epic
    When PAY-123 is reviewed in the studio
    Then it is shown ready, with no capability, `billing` and `orders` offered, and opening it in `orders` runs `propose --from-ticket PAY-123 --capability orders`
